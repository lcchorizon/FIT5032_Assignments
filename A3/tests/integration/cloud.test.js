// Check Firestore rules and callable booking behaviour in an isolated emulator project.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'

const projectId = 'demo-greenconnect-a3'
let environment
const apps = []
const path = (...parts) => ['greenconnect', 'v1', ...parts]

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') },
  })
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, ...path('events', 'test-event')), {
      title: 'Test planting day', startAt: '2099-11-01T10:00:00+11:00', endAt: '2099-11-01T12:00:00+11:00', capacity: 10, bookedPlaces: 0, location: 'Test garden', ratingCount: 0, ratingTotal: 0,
    })
    await setDoc(doc(db, ...path('events', 'past-event')), { title: 'Past event', startAt: '2020-01-01T00:00:00Z' })
    await setDoc(doc(db, ...path('profiles', 'alice')), { fullName: 'Alice Member', role: 'member' })
    await setDoc(doc(db, ...path('registrations', 'alice-event')), { userId: 'alice', fullName: 'Alice Member' })
    await setDoc(doc(db, ...path('registrations', 'bob-event')), { userId: 'bob', fullName: 'Bob Member' })
  })
})
after(async () => {
  await Promise.all(apps.map(deleteApp))
  await environment?.cleanup()
})

test('public reads are restricted to event details', async () => {
  const db = environment.unauthenticatedContext().firestore()
  await assertSucceeds(getDocs(collection(db, ...path('events'))))
  await assertFails(getDoc(doc(db, ...path('profiles', 'alice'))))
  await assertFails(getDocs(collection(db, ...path('registrations'))))
  await assertFails(setDoc(doc(db, ...path('events', 'fake')), { title: 'Fake' }))
})

test('members cannot escalate role or read other members; owner queries work', async () => {
  const db = environment.authenticatedContext('alice', { email: 'alice@example.test' }).firestore()
  await assertSucceeds(getDoc(doc(db, ...path('profiles', 'alice'))))
  await assertFails(getDoc(doc(db, ...path('profiles', 'bob'))))
  await assertFails(getDocs(collection(db, ...path('profiles'))))
  await assertFails(setDoc(doc(db, ...path('profiles', 'alice')), { role: 'admin' }))
  await assertSucceeds(getDocs(query(collection(db, ...path('registrations')), where('userId', '==', 'alice'))))
  await assertFails(getDoc(doc(db, ...path('registrations', 'bob-event'))))
  await assertFails(getDocs(collection(db, ...path('registrations'))))
  await assertFails(setDoc(doc(db, ...path('registrations', 'new')), { userId: 'alice' }))
  await assertFails(getDoc(doc(db, ...path('schedules', 'alice'))))
  await assertFails(setDoc(doc(db, ...path('schedules', 'alice')), { reservations: [] }))
  await assertFails(getDoc(doc(db, ...path('mail', 'private-message'))))
  await assertFails(setDoc(doc(db, ...path('mailLimits', 'alice')), { count: 0 }))
})

test('only a signed admin claim grants record access; admin client writes remain blocked', async () => {
  const db = environment.authenticatedContext('admin', { greenconnectAdmin: true }).firestore()
  await assertSucceeds(getDocs(collection(db, ...path('profiles'))))
  await assertSucceeds(getDocs(collection(db, ...path('registrations'))))
  await assertFails(setDoc(doc(db, ...path('profiles', 'alice')), { role: 'admin' }))
  await assertFails(getDoc(doc(db, ...path('mail', 'private-message'))))
  const wrongClaim = environment.authenticatedContext('wrong', { admin: true }).firestore()
  await assertFails(getDocs(collection(wrongClaim, ...path('profiles'))))
})

const client = async (name, signedIn = true) => {
  const app = initializeApp({ apiKey: 'demo-key', projectId, appId: `test-${name}` }, `${name}-${Date.now()}`)
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const functions = getFunctions(app, 'us-central1')
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  if (signedIn) await createUserWithEmailAndPassword(auth, `${name}-${Date.now()}@example.test`, 'TestPassword123!')
  return { auth, call: (name, data) => httpsCallable(functions, name)(data) }
}

const failsWith = async (promise, code) => assert.rejects(promise, (error) => error.code === `functions/${code}`)

test('callable functions reject anonymous requests', async () => {
  const anonymous = await client('anonymous', false)
  for (const name of ['greenconnectProfile', 'greenconnectRegisterInterest', 'greenconnectBookEvent', 'greenconnectCancelBooking', 'greenconnectRateEvent']) {
    await failsWith(anonymous.call(name, {}), 'unauthenticated')
  }
})

test('profile data ignores role, UID and email supplied by the caller', async () => {
  const member = await client('profile')
  const { data } = await member.call('greenconnectProfile', {
    fullName: 'New Member', role: 'admin', userId: 'someone-else', email: 'other@example.test',
  })
  assert.equal(data.id, member.auth.currentUser.uid)
  assert.equal(data.email, member.auth.currentUser.email)
  assert.equal(data.role, 'member')
  assert.equal(data.fullName, 'New Member')
  await failsWith(member.call('greenconnectProfile', { fullName: '<script>' }), 'invalid-argument')
})

test('registrations use the authenticated identity and reject duplicates or invalid events', async () => {
  const member = await client('registration')
  const details = { eventId: 'test-event', fullName: 'Test Member', participants: 2, experienceLevel: 'Beginner', termsAccepted: true, userId: 'bob', email: 'other@example.test' }
  const { data } = await member.call('greenconnectBookEvent', details)
  assert.equal(data.status, 'confirmed')
  const db = environment.authenticatedContext(member.auth.currentUser.uid).firestore()
  const snapshot = await getDoc(doc(db, ...path('registrations', data.id)))
  assert.equal(snapshot.data().userId, member.auth.currentUser.uid)
  assert.equal(snapshot.data().email, member.auth.currentUser.email)
  await failsWith(member.call('greenconnectBookEvent', details), 'already-exists')
  await failsWith(member.call('greenconnectBookEvent', { ...details, participants: 6 }), 'invalid-argument')
  await failsWith(member.call('greenconnectBookEvent', { ...details, eventId: 'past-event' }), 'failed-precondition')
  await failsWith(member.call('greenconnectBookEvent', { ...details, eventId: 'missing-event' }), 'failed-precondition')
})

test('ratings update one vote per UID and keep public totals correct', async () => {
  const member = await client('rating')
  const other = await client('rating-other')
  await member.call('greenconnectRateEvent', { eventId: 'test-event', score: 3 })
  await member.call('greenconnectRateEvent', { eventId: 'test-event', score: 5 })
  await other.call('greenconnectRateEvent', { eventId: 'test-event', score: 1 })
  const db = environment.unauthenticatedContext().firestore()
  const event = await getDoc(doc(db, ...path('events', 'test-event')))
  assert.equal(event.data().ratingCount, 2)
  assert.equal(event.data().ratingTotal, 6)
  await failsWith(member.call('greenconnectRateEvent', { eventId: 'test-event', score: 6 }), 'invalid-argument')
  await assertFails(getDoc(doc(db, ...path('events', 'test-event', 'ratings', member.auth.currentUser.uid))))
})

const bookingDetails = (eventId, participants = 1) => ({ eventId, fullName: 'Booking Member', participants, experienceLevel: 'Beginner', termsAccepted: true })
const seedEvent = async (id, { start = '2099-11-02T10:00:00+11:00', end = '2099-11-02T12:00:00+11:00', capacity = 10 } = {}) => {
  await environment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), ...path('events', id)), {
    title: id, startAt: start, endAt: end, capacity, bookedPlaces: 0, location: 'Test garden',
  }))
}
const publicEvent = async (id) => (await getDoc(doc(environment.unauthenticatedContext().firestore(), ...path('events', id)))).data()

test('two users racing for the final place cannot overbook', async () => {
  await seedEvent('last-place', { capacity: 1 })
  const first = await client('race-first')
  const second = await client('race-second')
  const results = await Promise.allSettled([
    first.call('greenconnectBookEvent', bookingDetails('last-place')),
    second.call('greenconnectBookEvent', bookingDetails('last-place')),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'functions/resource-exhausted')
  assert.equal((await publicEvent('last-place')).bookedPlaces, 1)
})

test('simultaneous overlapping bookings by one user are serialised across events', async () => {
  await seedEvent('overlap-a')
  await seedEvent('overlap-b', { start: '2099-11-02T11:00:00+11:00', end: '2099-11-02T13:00:00+11:00' })
  const member = await client('overlap')
  const results = await Promise.allSettled([
    member.call('greenconnectBookEvent', bookingDetails('overlap-a')),
    member.call('greenconnectBookEvent', bookingDetails('overlap-b')),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'functions/failed-precondition')
  assert.equal((await publicEvent('overlap-a')).bookedPlaces + (await publicEvent('overlap-b')).bookedPlaces, 1)
})

test('adjacent bookings are allowed; cancellation releases places only once and allows rebooking', async () => {
  await seedEvent('morning')
  await seedEvent('afternoon', { start: '2099-11-02T12:00:00+11:00', end: '2099-11-02T14:00:00+11:00' })
  const member = await client('cancel')
  const other = await client('not-owner')
  await member.call('greenconnectBookEvent', bookingDetails('morning', 3))
  await member.call('greenconnectBookEvent', bookingDetails('afternoon'))
  await failsWith(other.call('greenconnectCancelBooking', { eventId: 'morning', userId: member.auth.currentUser.uid }), 'not-found')
  assert.equal((await publicEvent('morning')).bookedPlaces, 3)
  await Promise.all([
    member.call('greenconnectCancelBooking', { eventId: 'morning' }),
    member.call('greenconnectCancelBooking', { eventId: 'morning' }),
  ])
  assert.equal((await publicEvent('morning')).bookedPlaces, 0)
  const own = environment.authenticatedContext(member.auth.currentUser.uid).firestore()
  const cancelled = await getDoc(doc(own, ...path('registrations', `${member.auth.currentUser.uid}_morning`)))
  assert.equal(cancelled.data().status, 'cancelled')
  await member.call('greenconnectBookEvent', bookingDetails('morning', 2))
  assert.equal((await publicEvent('morning')).bookedPlaces, 2)
})

test('group capacity, invalid event times and already started cancellation are enforced on the server', async () => {
  const member = await client('constraints')
  await seedEvent('small-group', { capacity: 2 })
  await failsWith(member.call('greenconnectBookEvent', bookingDetails('small-group', 3)), 'resource-exhausted')
  await seedEvent('invalid-time', { end: '2099-11-02T09:00:00+11:00' })
  await failsWith(member.call('greenconnectBookEvent', bookingDetails('invalid-time')), 'failed-precondition')
  await seedEvent('started-cancel')
  await member.call('greenconnectBookEvent', bookingDetails('started-cancel'))
  await environment.withSecurityRulesDisabled((context) => setDoc(
    doc(context.firestore(), ...path('registrations', `${member.auth.currentUser.uid}_started-cancel`)),
    { startAt: '2020-01-01T00:00:00Z' }, { merge: true },
  ))
  await failsWith(member.call('greenconnectCancelBooking', { eventId: 'started-cancel' }), 'failed-precondition')
  assert.equal((await publicEvent('started-cancel')).bookedPlaces, 1)
})

test('legacy interests do not reserve capacity and can be upgraded to confirmed bookings', async () => {
  await seedEvent('legacy-interest')
  const member = await client('legacy')
  await environment.withSecurityRulesDisabled((context) => setDoc(
    doc(context.firestore(), ...path('registrations', `${member.auth.currentUser.uid}_legacy-interest`)),
    { userId: member.auth.currentUser.uid, eventId: 'legacy-interest', status: 'interest', participants: 2 },
  ))
  await failsWith(member.call('greenconnectCancelBooking', { eventId: 'legacy-interest' }), 'failed-precondition')
  await member.call('greenconnectBookEvent', bookingDetails('legacy-interest', 2))
  assert.equal((await publicEvent('legacy-interest')).bookedPlaces, 2)
  await failsWith(member.call('greenconnectRegisterInterest', bookingDetails('legacy-interest')), 'failed-precondition')
})
