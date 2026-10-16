import { createRequire } from 'node:module'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')
import { readFile } from 'node:fs/promises'

if (process.argv.includes('--production')) throw new Error('This script is only for local emulators.')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
initializeApp({ projectId: 'demo-greenconnect-a3' })
const auth = getAuth()
const root = getFirestore().doc('greenconnect/v1')
const accounts = [
  { uid: 'demo-admin', email: 'admin@example.test', fullName: 'Demo Admin', admin: true },
  { uid: 'demo-member', email: 'member@example.test', fullName: 'Demo Member', admin: false },
]
for (const account of accounts) {
  const details = { email: account.email, password: 'LocalDemo123!', displayName: account.fullName }
  try { await auth.getUser(account.uid) } catch { await auth.createUser({ uid: account.uid, ...details }) }
  await auth.setCustomUserClaims(account.uid, { greenconnectAdmin: account.admin })
  await root.collection('profiles').doc(account.uid).set({
    email: account.email, fullName: account.fullName, role: account.admin ? 'admin' : 'member', createdAt: FieldValue.serverTimestamp(),
  })
}
const events = JSON.parse(await readFile(new URL('../src/assets/json/events.json', import.meta.url), 'utf8'))
for (const { id, ...event } of events) {
  const ref = root.collection('events').doc(id)
  if (!(await ref.get()).exists) await ref.set(event)
}
console.log('Local example events and two local accounts are ready. See README for emulator-only sign-in details.')
