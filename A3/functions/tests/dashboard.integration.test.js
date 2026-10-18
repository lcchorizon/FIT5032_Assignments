// Check real emulator Auth claims and Firestore snapshots. No production accounts are created here.
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { adminDashboard } from '../dashboard.js'
import { bookEvent, cancelBooking } from '../bookings.js'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Use local emulators for these checks.')
initializeApp({ projectId: 'demo-greenconnect-a3' })
const auth = getAuth(),
  db = getFirestore(),
  root = db.doc('greenconnect/v1')
const users = []
const ids = []
const eventId = `dashboard-${crypto.randomUUID()}`
let admin, member
const adminRequest = () => ({ auth: { uid: admin.uid, token: { greenconnectAdmin: true } } })
const memberRequest = (data = {}) => ({
  auth: { uid: member.uid, token: { email: member.email } },
  data,
})
const load = () => adminDashboard(adminRequest(), { db, auth })
const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code)
before(async () => {
  for (const role of ['admin', 'member', 'unrelated']) {
    const user = await auth.createUser({
      email: `dashboard-${role}-${crypto.randomUUID()}@example.test`,
    })
    users.push(user)
    if (role !== 'unrelated') {
      ids.push(user.uid)
      // The member has a fake admin profile field to prove the role count does not trust it.
      await root.collection('profiles').doc(user.uid).set({ role: 'admin' })
    }
  }
  ;[admin, member] = users
  await auth.setCustomUserClaims(admin.uid, { greenconnectAdmin: true })
  await root
    .collection('events')
    .doc(eventId)
    .set({
      title: 'Dashboard test activity',
      category: 'Test',
      location: 'Test garden',
      startAt: '2099-11-01T10:00:00+11:00',
      endAt: '2099-11-01T12:00:00+11:00',
      capacity: 10,
      bookedPlaces: 0,
      isDemo: true,
    })
})
after(async () => {
  await root.collection('events').doc(eventId).delete()
  await root.collection('registrations').doc(`${member.uid}_${eventId}`).delete()
  await root.collection('schedules').doc(member.uid).delete()
  await root.collection('registrations').doc(`dashboard-private-${member.uid}`).delete()
  await Promise.all(ids.map((id) => root.collection('profiles').doc(id).delete()))
  await Promise.all(users.map((user) => auth.deleteUser(user.uid)))
})
test('anonymous, ordinary members and revoked admins cannot load the dashboard', async () => {
  await rejects(adminDashboard({}, { db, auth }), 'unauthenticated')
  await rejects(adminDashboard(memberRequest(), { db, auth }), 'permission-denied')
  await rejects(
    adminDashboard({ auth: { uid: member.uid, token: { greenconnectAdmin: true } } }, { db, auth }),
    'permission-denied',
  )
})
test('role counts use current Auth claims, ignore unrelated accounts and omit personal identity', async () => {
  const result = await load()
  assert.equal(result.accounts.total, 2)
  assert.equal(result.accounts.admins, 1)
  assert.equal(result.accounts.members, 1)
  await root
    .collection('registrations')
    .doc(`dashboard-private-${member.uid}`)
    .set({
      eventId,
      status: 'interest',
      participants: 1,
      email: 'private-address@example.test',
      fullName: 'Private Person',
      userId: member.uid,
      createdAt: Timestamp.fromDate(new Date('2026-10-17T14:00:00Z')),
    })
  const next = await load()
  assert.equal(next.registrations.find((row) => row.status === 'interest').createdDay, '2026-10-18')
  const json = JSON.stringify(next)
  for (const privateValue of [
    'private-address@example.test',
    'Private Person',
    member.uid,
    'userId',
    'fullName',
  ])
    assert.equal(json.includes(privateValue), false)
})
test('real booking and cancellation update participant statistics and event capacity together', async () => {
  await bookEvent(
    memberRequest({
      eventId,
      fullName: 'Test Member',
      participants: 3,
      experienceLevel: 'Beginner',
      termsAccepted: true,
    }),
  )
  const booked = await load()
  assert.equal(booked.events.find((event) => event.id === eventId).bookedPlaces, 3)
  assert.equal(
    booked.registrations
      .filter((row) => row.status === 'confirmed')
      .reduce((sum, row) => sum + row.participants, 0),
    3,
  )
  await cancelBooking(memberRequest({ eventId }))
  const cancelled = await load()
  assert.equal(cancelled.events.find((event) => event.id === eventId).bookedPlaces, 0)
  assert.equal(cancelled.registrations.filter((row) => row.status === 'confirmed').length, 0)
  assert.equal(cancelled.registrations.filter((row) => row.status === 'cancelled').length, 1)
})
