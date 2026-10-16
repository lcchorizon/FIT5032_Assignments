import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { validId, validName } from './validation.js'
import { bookEvent, cancelBooking } from './bookings.js'

initializeApp()
setGlobalOptions({ region: 'us-central1', maxInstances: 3 })
const root = getFirestore().doc('greenconnect/v1')
const roleFor = (auth) => auth.token.greenconnectAdmin === true ? 'admin' : 'member'

const requireUser = (request) => {
  if (!request.auth || !request.auth.token.email) {
    throw new HttpsError('unauthenticated', 'Please log in to continue.')
  }
  return request.auth
}

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
    const ratingCount = (event.ratingCount || 0) + (previous.exists ? 0 : 1)
    const ratingTotal = (event.ratingTotal || 0) - (previous.data()?.score || 0) + score
    transaction.set(ratingRef, { score, updatedAt: FieldValue.serverTimestamp() })
    transaction.update(eventRef, { ratingCount, ratingTotal })
  })
  return { score }
})
