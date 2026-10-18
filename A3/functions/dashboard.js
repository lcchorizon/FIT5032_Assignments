// Build an admin-only snapshot without sending member names, emails or account IDs to the charts.
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Melbourne',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const dayFor = (value) => {
  const date = value?.toDate?.()
  if (!date || !Number.isFinite(date.getTime())) return null
  const parts = Object.fromEntries(
    dateFormat.formatToParts(date).map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const adminDashboard = async (request, { db = getFirestore(), auth = getAuth() } = {}) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please log in to continue.')
  if (request.auth.token.greenconnectAdmin !== true)
    throw new HttpsError('permission-denied', 'Only administrators can open the dashboard.')
  // Check the current Auth record too, so a removed admin role cannot keep using an old token here.
  const operator = await auth.getUser(request.auth.uid)
  if (operator.disabled || operator.customClaims?.greenconnectAdmin !== true) {
    throw new HttpsError(
      'permission-denied',
      'Your administrator access is no longer available. Log in again.',
    )
  }
  const root = db.doc('greenconnect/v1')
  // One read-only transaction keeps event capacity and booking records at the same Firestore snapshot.
  const [profiles, events, bookings] = await db.runTransaction(
    (tx) =>
      Promise.all([
        tx.get(root.collection('profiles').select().limit(2001)),
        tx.get(
          root
            .collection('events')
            .select(
              'title',
              'category',
              'location',
              'startAt',
              'endAt',
              'capacity',
              'bookedPlaces',
              'isDemo',
            )
            .limit(501),
        ),
        tx.get(
          root
            .collection('registrations')
            .select('eventId', 'status', 'participants', 'createdAt', 'confirmedAt')
            .limit(5001),
        ),
      ]),
    { readOnly: true },
  )
  if (profiles.size > 2000 || events.size > 500 || bookings.size > 5000) {
    throw new HttpsError(
      'resource-exhausted',
      'The dashboard needs a paged summary for this amount of data.',
    )
  }
  // Count only accounts linked to this app, because the Firebase project also hosts other coursework.
  const accounts = { total: 0, admins: 0, members: 0, disabled: 0, missingAuthAccounts: 0 }
  for (let index = 0; index < profiles.docs.length; index += 100) {
    const result = await auth.getUsers(
      profiles.docs.slice(index, index + 100).map((profile) => ({ uid: profile.id })),
    )
    accounts.missingAuthAccounts += result.notFound.length
    for (const user of result.users) {
      accounts.total++
      if (user.customClaims?.greenconnectAdmin === true) accounts.admins++
      else accounts.members++
      if (user.disabled) accounts.disabled++
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    accounts,
    events: events.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    // Dates are enough for charts. Individual identities are deliberately left out of this response.
    registrations: bookings.docs.map((doc) => {
      const data = doc.data()
      return {
        eventId: data.eventId || '',
        status: data.status || 'unknown',
        participants:
          Number.isInteger(data.participants) && data.participants >= 1 && data.participants <= 5
            ? data.participants
            : 0,
        createdDay: dayFor(data.createdAt),
        confirmedDay: dayFor(data.confirmedAt),
      }
    }),
  }
}
