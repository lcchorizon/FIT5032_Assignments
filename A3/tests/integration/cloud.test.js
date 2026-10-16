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
      title: 'Test planting day', startAt: '2099-11-01T10:00:00+11:00', ratingCount: 0, ratingTotal: 0,
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
})

test('only a signed admin claim grants record access; admin client writes remain blocked', async () => {
  const db = environment.authenticatedContext('admin', { greenconnectAdmin: true }).firestore()
  await assertSucceeds(getDocs(collection(db, ...path('profiles'))))
  await assertSucceeds(getDocs(collection(db, ...path('registrations'))))
  await assertFails(setDoc(doc(db, ...path('profiles', 'alice')), { role: 'admin' }))
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
  for (const name of ['greenconnectProfile', 'greenconnectRegisterInterest', 'greenconnectRateEvent']) {
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
  const { data } = await member.call('greenconnectRegisterInterest', details)
  assert.equal(data.status, 'interest')
  const db = environment.authenticatedContext(member.auth.currentUser.uid).firestore()
  const snapshot = await getDoc(doc(db, ...path('registrations', data.id)))
  assert.equal(snapshot.data().userId, member.auth.currentUser.uid)
  assert.equal(snapshot.data().email, member.auth.currentUser.email)
  await failsWith(member.call('greenconnectRegisterInterest', details), 'already-exists')
  await failsWith(member.call('greenconnectRegisterInterest', { ...details, participants: 6 }), 'invalid-argument')
  await failsWith(member.call('greenconnectRegisterInterest', { ...details, eventId: 'past-event' }), 'failed-precondition')
  await failsWith(member.call('greenconnectRegisterInterest', { ...details, eventId: 'missing-event' }), 'failed-precondition')
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
