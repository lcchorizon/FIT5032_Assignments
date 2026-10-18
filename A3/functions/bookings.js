// Reserve and release places with Firestore transactions so competing requests stay consistent.
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { experienceLevels, validId, validName, validParticipants } from './validation.js'

// Strict comparisons allow one activity to start exactly when the previous one ends.
export const intervalsOverlap = (start, end, otherStart, otherEnd) =>
  start < otherEnd && end > otherStart

const requireUser = (request) => {
  if (!request.auth?.token.email) throw new HttpsError('unauthenticated', 'Please log in to continue.')
  return request.auth
}

export const bookEvent = async (request) => {
  const auth = requireUser(request)
  const { eventId, fullName, participants, experienceLevel, termsAccepted } = request.data || {}
  if (!validId(eventId) || !validName(fullName) || !validParticipants(participants) ||
      !experienceLevels.includes(experienceLevel) || termsAccepted !== true) {
    throw new HttpsError('invalid-argument', 'Check your booking details and try again.')
  }
  const db = getFirestore()
  const root = db.doc('greenconnect/v1')
  const eventRef = root.collection('events').doc(eventId)
  // A deterministic document ID gives one booking record per account and event.
  const bookingRef = root.collection('registrations').doc(`${auth.uid}_${eventId}`)
  const scheduleRef = root.collection('schedules').doc(auth.uid)

  // Read and write the event, booking and member schedule together.
  // Firestore retries this callback if a competing request changes a document we read.
  return db.runTransaction(async (transaction) => {
    const [eventSnapshot, bookingSnapshot, scheduleSnapshot] = await transaction.getAll(eventRef, bookingRef, scheduleRef)
    const event = eventSnapshot.data()
    const start = Date.parse(event?.startAt)
    const end = Date.parse(event?.endAt)
    if (!event || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || start <= Date.now()) {
      throw new HttpsError('failed-precondition', 'This event is no longer accepting bookings.')
    }
    if (bookingSnapshot.data()?.status === 'confirmed') {
      throw new HttpsError('already-exists', 'You already have a confirmed booking for this event.')
    }
    // The schedule document is shared by all booking requests from this member, including different events.
    const reservations = scheduleSnapshot.data()?.reservations || []
    if (reservations.some((booking) => booking.eventId !== eventId &&
        intervalsOverlap(start, end, Date.parse(booking.startAt), Date.parse(booking.endAt)))) {
      throw new HttpsError('failed-precondition', 'This event overlaps with one of your confirmed bookings. Choose a different time or cancel the other booking first.')
    }
    // Check remaining places inside the transaction. A number displayed earlier in the browser can be stale.
    const bookedPlaces = event.bookedPlaces ?? 0
    if (!Number.isInteger(event.capacity) || !Number.isInteger(bookedPlaces) || bookedPlaces < 0 ||
        participants > event.capacity - bookedPlaces) {
      throw new HttpsError('resource-exhausted', 'There are not enough places left for your group. Reduce the group size or choose another event.')
    }
    // A cancelled booking can be replaced by a new confirmed version. confirmedAt identifies that confirmation.
    transaction.set(bookingRef, {
      userId: auth.uid, eventId, eventTitle: event.title, fullName: fullName.trim(),
      email: auth.token.email, participants, experienceLevel, status: 'confirmed',
      startAt: event.startAt, endAt: event.endAt, location: event.location,
      createdAt: bookingSnapshot.data()?.createdAt || FieldValue.serverTimestamp(),
      confirmedAt: FieldValue.serverTimestamp(),
    })
    // This document also serialises two bookings made by the same member at the same time.
    transaction.set(scheduleRef, {
      reservations: [...reservations.filter((booking) => booking.eventId !== eventId && Date.parse(booking.endAt) > Date.now()),
        { eventId, startAt: event.startAt, endAt: event.endAt }],
    })
    transaction.update(eventRef, { bookedPlaces: bookedPlaces + participants })
    return { id: bookingRef.id, status: 'confirmed', participants }
  })
}

// Cancellation checks ownership again on the server and releases capacity in the same transaction.
export const cancelBooking = async (request) => {
  const auth = requireUser(request)
  const { eventId } = request.data || {}
  if (!validId(eventId)) throw new HttpsError('invalid-argument', 'Choose a valid booking.')
  const db = getFirestore()
  const root = db.doc('greenconnect/v1')
  const eventRef = root.collection('events').doc(eventId)
  const bookingRef = root.collection('registrations').doc(`${auth.uid}_${eventId}`)
  const scheduleRef = root.collection('schedules').doc(auth.uid)

  return db.runTransaction(async (transaction) => {
    const [eventSnapshot, bookingSnapshot, scheduleSnapshot] = await transaction.getAll(eventRef, bookingRef, scheduleRef)
    const booking = bookingSnapshot.data()
    if (!booking || booking.userId !== auth.uid) throw new HttpsError('not-found', 'This booking could not be found.')
    // Repeated cancellation returns the existing result and does not subtract places a second time.
    if (booking.status === 'cancelled') return { id: bookingRef.id, status: 'cancelled' }
    if (booking.status !== 'confirmed') {
      throw new HttpsError('failed-precondition', 'This record is an interest only. It has not reserved any places.')
    }
    const start = Date.parse(booking.startAt)
    if (!Number.isFinite(start) || start <= Date.now()) {
      throw new HttpsError('failed-precondition', 'Bookings cannot be cancelled after the event has started.')
    }
    const event = eventSnapshot.data()
    if (!event || !Number.isInteger(event.bookedPlaces) || !validParticipants(booking.participants) ||
        event.bookedPlaces < booking.participants) {
      throw new HttpsError('failed-precondition', 'The booking could not be updated. Please contact the organiser.')
    }
    transaction.update(bookingRef, { status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() })
    transaction.update(eventRef, { bookedPlaces: event.bookedPlaces - booking.participants })
    transaction.set(scheduleRef, { reservations: (scheduleSnapshot.data()?.reservations || []).filter((item) => item.eventId !== eventId) })
    return { id: bookingRef.id, status: 'cancelled' }
  })
}
