// Read an owned booking on the server and submit one PDF confirmation to the account email.
import { createHash, randomUUID } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { validId } from './validation.js'
import { createReceipt, receiptRows } from './receipt.js'

const hour = 60 * 60 * 1000
// Both the text and attachment use saved booking fields. The caller cannot supply their own attachment.
export const emailPayload = async (booking, reference, issuedAt, from) => ({
  from, to: [booking.email], subject: 'Your GreenConnect booking confirmation',
  text: `Your booking is confirmed.\n\n${receiptRows(booking, reference).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\nThe attached PDF has your booking details. These are demonstration activities.\nView or cancel your booking: https://greenconnect-a3-66c61.web.app/#my-bookings`,
  attachments: [{ filename: 'greenconnect-booking.pdf', content: (await createReceipt(booking, reference, issuedAt)).toString('base64'), content_type: 'application/pdf' }],
})

// A successful provider response means accepted for sending. It is not proof of inbox delivery.
export const sendWithResend = async (payload, key, apiKey, fetcher = fetch) => {
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Email provider did not accept the request.')
  const result = await response.json()
  if (typeof result.id !== 'string' || !result.id) throw new Error('Email provider returned no message reference.')
  return result.id
}

// Each confirmation keeps the same payload and provider key when a request is retried.
export const sendBookingEmail = async (request, { apiKey, from, db = getFirestore(), auth = getAuth(), transport = sendWithResend, now = Date.now } = {}) => {
  if (!request.auth?.token.email) throw new HttpsError('unauthenticated', 'Please log in to continue.')
  const { eventId } = request.data || {}
  if (!validId(eventId)) throw new HttpsError('invalid-argument', 'Choose a valid booking.')
  // Read the current Auth record so a stale token cannot send to an old or unverified email address.
  const user = await auth.getUser(request.auth.uid)
  if (user.disabled || !user.emailVerified || !user.email) {
    throw new HttpsError('failed-precondition', 'Verify your account email before sending a booking confirmation.')
  }
  if (!apiKey || !from) throw new HttpsError('failed-precondition', 'Booking emails are not configured yet. Your booking is still saved.')
  const root = db.doc('greenconnect/v1')
  const bookingRef = root.collection('registrations').doc(`${user.uid}_${eventId}`)
  const bookingSnapshot = await bookingRef.get()
  const booking = bookingSnapshot.data()
  if (!booking || booking.userId !== user.uid) throw new HttpsError('not-found', 'This booking could not be found.')
  if (booking.status !== 'confirmed') throw new HttpsError('failed-precondition', 'Only confirmed bookings can be emailed.')
  const confirmedAt = booking.confirmedAt?.toMillis()
  if (!confirmedAt) throw new HttpsError('failed-precondition', 'Please contact the organiser about this booking.')
  // Use the booking version and recipient for one stable send key. Rebooking produces a new confirmation version.
  const key = createHash('sha256').update(`${bookingRef.id}:${confirmedAt}:${user.email}`).digest('hex')
  const mailRef = root.collection('mail').doc(key)
  const limitRef = root.collection('mailLimits').doc(user.uid)
  const time = now()
  const lease = randomUUID()
  const payload = await emailPayload({ ...booking, email: user.email }, bookingRef.id, time, from)
  // Claim the mail job and update the account limit atomically, so simultaneous clicks cannot both submit.
  const job = await db.runTransaction(async (tx) => {
    const [currentBooking, existing, limitSnapshot] = await tx.getAll(bookingRef, mailRef, limitRef)
    if (currentBooking.data()?.status !== 'confirmed' || currentBooking.data()?.confirmedAt?.toMillis() !== confirmedAt) {
      throw new HttpsError('failed-precondition', 'Your booking changed. Refresh My bookings before sending.')
    }
    const mail = existing.data()
    // An accepted job returns its previous result before consuming another attempt.
    if (mail?.status === 'accepted') return { accepted: true }
    // Stop uncertain retries before the provider forgets its 24-hour idempotency key.
    if (mail && time - mail.createdAtMs > 23 * hour) {
      throw new HttpsError('failed-precondition', 'This earlier send could not be confirmed. Please contact the organiser before trying again.')
    }
    // The lease gives the current request time to contact the provider. Another request must wait.
    if (mail?.leaseUntil > time) throw new HttpsError('resource-exhausted', 'This email is being submitted. Wait a minute before trying again.')
    const limit = limitSnapshot.data() || {}
    // The daily limit uses UTC for a consistent reset across server instances.
    const day = new Date(time).toISOString().slice(0, 10)
    const count = limit.day === day ? limit.count || 0 : 0
    if (limit.lastAttemptMs > time - 60000 || count >= 5) {
      throw new HttpsError('resource-exhausted', count >= 5 ? 'The daily email limit has been reached. Please try tomorrow.' : 'Wait one minute before sending another email.')
    }
    tx.set(limitRef, { day, count: count + 1, lastAttemptMs: time })
    // Store the first payload and reuse it on retries. Even the PDF bytes must match the same provider key.
    tx.set(mailRef, { userId: user.uid, bookingId: bookingRef.id, createdAtMs: mail?.createdAtMs ?? time,
      payload: mail?.payload || payload, status: 'submitting', lease, leaseUntil: time + 60000 })
    return { payload: mail?.payload || payload }
  })
  if (job.accepted) return { status: 'accepted', alreadySubmitted: true }
  try {
    const providerId = await transport(job.payload, key, apiKey)
    // Save acceptance only after the provider returns a message ID. No delivered status is claimed here.
    await mailRef.update({ status: 'accepted', providerId, acceptedAt: FieldValue.serverTimestamp(), leaseUntil: 0 })
    return { status: 'accepted', alreadySubmitted: false }
  } catch {
    // A network error may happen after acceptance. Retrying uses the stored provider key.
    await db.runTransaction(async (tx) => {
      const current = await tx.get(mailRef)
      if (current.data()?.lease === lease && current.data()?.status !== 'accepted') {
        tx.update(mailRef, { status: 'unconfirmed', leaseUntil: 0 })
      }
    }).catch(() => {})
    throw new HttpsError('unavailable', 'The email submission could not be confirmed. Wait one minute and try again. Your booking is still saved.')
  }
}
