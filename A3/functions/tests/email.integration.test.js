// Use real emulator Auth and Firestore with a fake mail transport. No real email is sent by these tests.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { sendBookingEmail } from '../email.js'

const projectId = 'demo-greenconnect-a3'
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('These checks require local emulators.')
initializeApp({ projectId })
const db = getFirestore()
const auth = getAuth()
const root = db.doc('greenconnect/v1')
const users = []
const bookings = []
let member
let other
let time = Date.now()
const options = (transport) => ({ apiKey: 'local-test-only', from: 'GreenConnect <bookings@example.test>', db, auth, transport, now: () => time })
const request = (user, eventId, data = {}) => ({ auth: { uid: user.uid, token: { email: user.email } }, data: { eventId, ...data } })
const fails = (promise, code) => assert.rejects(promise, (error) => error.code === code)
const seed = async (eventId, status = 'confirmed') => {
  const ref = root.collection('registrations').doc(`${member.uid}_${eventId}`)
  bookings.push(ref)
  await ref.set({ userId: member.uid, eventId, eventTitle: 'Email test activity', fullName: 'Test Member', email: member.email,
    startAt: '2099-11-01T10:00:00+11:00', endAt: '2099-11-01T12:00:00+11:00', location: 'Test garden', participants: 2,
    status, confirmedAt: Timestamp.fromMillis(time) })
  return ref
}
before(async () => {
  for (const verified of [true, true, false]) users.push(await auth.createUser({ email: `email-check-${crypto.randomUUID()}@example.test`, emailVerified: verified }))
  ;[member, other] = users
})
after(async () => {
  for (const user of users) {
    const mail = await root.collection('mail').where('userId', '==', user.uid).get()
    await Promise.all(mail.docs.map((doc) => doc.ref.delete()))
    await root.collection('mailLimits').doc(user.uid).delete()
    await auth.deleteUser(user.uid)
  }
  await Promise.all(bookings.map((ref) => ref.delete()))
})

test('email requires login, current verified email, own confirmed booking and server configuration', async () => {
  let calls = 0
  const opts = options(async () => { calls++; return 'mock-id' })
  await seed('email-ownership')
  await fails(sendBookingEmail({ data: {} }, opts), 'unauthenticated')
  await fails(sendBookingEmail(request(users[2], 'email-ownership'), opts), 'failed-precondition')
  await fails(sendBookingEmail(request(other, 'email-ownership', { userId: member.uid }), opts), 'not-found')
  await fails(sendBookingEmail(request(member, '../bad'), opts), 'invalid-argument')
  await fails(sendBookingEmail(request(member, 'email-ownership'), { ...opts, apiKey: '' }), 'failed-precondition')
  await seed('email-cancelled', 'cancelled')
  await fails(sendBookingEmail(request(member, 'email-cancelled'), opts), 'failed-precondition')
  assert.equal(calls, 0)
})

test('concurrent requests submit once, ignore supplied recipient and remain idempotent', async () => {
  await seed('email-once')
  let calls = 0
  const opts = options(async (payload) => {
    calls++
    assert.deepEqual(payload.to, [member.email])
    assert.ok(payload.attachments[0].content.length > 100)
    return 'mock-message-id'
  })
  const input = request(member, 'email-once', { email: other.email, to: other.email, attachments: [] })
  const results = await Promise.allSettled([sendBookingEmail(input, opts), sendBookingEmail(input, opts)])
  assert.ok(results.some((result) => result.status === 'fulfilled'))
  assert.equal(calls, 1)
  assert.equal((await sendBookingEmail(input, opts)).alreadySubmitted, true)
  assert.equal(calls, 1)
})

test('failed submissions retry the identical payload and key; throttles apply across bookings', async () => {
  time += 61000
  await seed('email-retry')
  let first
  await fails(sendBookingEmail(request(member, 'email-retry'), options(async (payload, key) => {
    first = { payload, key }; throw new Error('simulated timeout after acceptance')
  })), 'unavailable')
  await fails(sendBookingEmail(request(member, 'email-retry'), options(async () => 'unused')), 'resource-exhausted')
  time += 61000
  const result = await sendBookingEmail(request(member, 'email-retry'), options(async (payload, key) => {
    assert.deepEqual(payload, first.payload); assert.equal(key, first.key)
    return 'mock-recovered-id'
  }))
  assert.equal(result.status, 'accepted')
  await seed('email-next')
  await fails(sendBookingEmail(request(member, 'email-next'), options(async () => 'unused')), 'resource-exhausted')
  time += 61000
  await root.collection('mailLimits').doc(member.uid).set({ day: new Date(time).toISOString().slice(0, 10), count: 5, lastAttemptMs: time - 61000 })
  await fails(sendBookingEmail(request(member, 'email-next'), options(async () => 'unused')), 'resource-exhausted')
})

test('uncertain requests stop retrying before the provider idempotency window expires', async () => {
  time += 86400000
  await seed('email-expiry')
  await fails(sendBookingEmail(request(member, 'email-expiry'), options(async () => { throw new Error('timeout') })), 'unavailable')
  time += 24 * 60 * 60 * 1000
  await fails(sendBookingEmail(request(member, 'email-expiry'), options(async () => 'unused')), 'failed-precondition')
})
