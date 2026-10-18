// Cloud Function entry points. Each callable function receives the authenticated Firebase request.
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { validId, validName } from './validation.js'
import { bookEvent, cancelBooking } from './bookings.js'
import { defineSecret, defineString } from 'firebase-functions/params'
import { sendBookingEmail } from './email.js'
import { publicApi } from './publicApi.js'
import { adminDashboard } from './dashboard.js'

// Initialise Admin SDK once per function process. It has privileged access, so handlers must check requests themselves.
initializeApp()
setGlobalOptions({ region: 'us-central1', maxInstances: 3 })
export const greenconnectPublicApi = onRequest({ timeoutSeconds: 30, maxInstances: 2 }, publicApi)
export const greenconnectAdminDashboard = onCall({ timeoutSeconds: 60 }, adminDashboard)
const root = getFirestore().doc('greenconnect/v1')
// Only the signed custom claim decides the role. A role sent in request data is ignored.
const roleFor = (auth) => auth.token.greenconnectAdmin === true ? 'admin' : 'member'

const requireUser = (request) => {
  if (!request.auth || !request.auth.token.email) {
    throw new HttpsError('unauthenticated', 'Please log in to continue.')
  }
  return request.auth
}

// Create the profile on first login, or update allowed details without storing passwords.
export const greenconnectProfile = onCall(async (request) => {
  const auth = requireUser(request)
  const fullName = request.data?.fullName
  if (fullName !== undefined && !validName(fullName)) {
    throw new HttpsError('invalid-argument', 'Enter a name with 3 to 50 characters, without < or >.')
  }
  const profileRef = root.collection('profiles').doc(auth.uid)
  return getFirestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(profileRef)
    const profile = {
      fullName: fullName?.trim() || existing.data()?.fullName || 'Community member',
      email: auth.token.email,
      role: roleFor(auth),
    }
    if (!existing.exists) {
      transaction.create(profileRef, { ...profile, createdAt: FieldValue.serverTimestamp() })
    } else if (Object.entries(profile).some(([key, value]) => existing.data()[key] !== value)) {
      transaction.update(profileRef, profile)
    }
    return { id: auth.uid, ...profile }
  })
})

export const greenconnectBookEvent = onCall(bookEvent)
export const greenconnectCancelBooking = onCall(cancelBooking)
// Bind the mail key from Secret Manager only to the email function. It must never be a VITE variable.
const resendKey = defineSecret('GREENCONNECT_RESEND_API_KEY')
const emailFrom = defineString('GREENCONNECT_EMAIL_FROM', { default: '' })
export const greenconnectSendBookingEmail = onCall({ secrets: [resendKey], timeoutSeconds: 60 }, (request) =>
  sendBookingEmail(request, { apiKey: resendKey.value(), from: emailFrom.value() }))

// Keep the earlier endpoint available but reject it, so old clients cannot bypass the new booking rules.
export const greenconnectRegisterInterest = onCall(async (request) => {
  requireUser(request)
  throw new HttpsError('failed-precondition', 'Bookings are now available. Refresh the page and use Book event to reserve a place.')
})

export const greenconnectRateEvent = onCall(async (request) => {
  const auth = requireUser(request)
  const { eventId, score } = request.data || {}
  if (!validId(eventId) || !Number.isInteger(score) || score < 1 || score > 5) {
    throw new HttpsError('invalid-argument', 'Choose a rating between 1 and 5.')
  }
  const eventRef = root.collection('events').doc(eventId)
  const ratingRef = eventRef.collection('ratings').doc(auth.uid)
  await getFirestore().runTransaction(async (transaction) => {
    const [eventSnapshot, previous] = await Promise.all([
      transaction.get(eventRef), transaction.get(ratingRef),
    ])
    if (!eventSnapshot.exists) throw new HttpsError('not-found', 'This event could not be found.')
    const event = eventSnapshot.data()
    // A returning voter changes the total, not the number of voters. All related changes commit together.
    const ratingCount = (event.ratingCount || 0) + (previous.exists ? 0 : 1)
    const ratingTotal = (event.ratingTotal || 0) - (previous.data()?.score || 0) + score
    transaction.set(ratingRef, { score, updatedAt: FieldValue.serverTimestamp() })
    transaction.update(eventRef, { ratingCount, ratingTotal })
  })
  return { score }
})
