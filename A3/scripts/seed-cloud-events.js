import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const projectId = process.argv[2]
if (projectId !== 'fit5032-66c61' || process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Pass the FIT5032 project ID and run without emulator variables.')
}
process.env.GOOGLE_CLOUD_QUOTA_PROJECT = projectId
initializeApp({ projectId, credential: applicationDefault() })
const root = getFirestore().doc('greenconnect/v1')
const events = JSON.parse(await readFile(new URL('../src/assets/json/events.json', import.meta.url), 'utf8'))
let created = 0
for (const { id, ...event } of events) {
  const ref = root.collection('events').doc(id)
  await getFirestore().runTransaction(async (transaction) => {
    if (!(await transaction.get(ref)).exists) {
      transaction.create(ref, event)
      created += 1
    }
  })
}
console.log(`Created ${created} missing demonstration events. Existing events were kept.`)
