// Correct four known demo coordinates only when the saved records still match the old placeholders.
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const projectId = process.argv[2]
if (!['demo-greenconnect-a3', 'fit5032-66c61'].includes(projectId)) throw new Error('Pass the local demo or FIT5032 project ID.')
if (projectId === 'demo-greenconnect-a3') process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
else {
  if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Remove the emulator setting before using the cloud project.')
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT = projectId
}
initializeApp({ projectId, ...(projectId === 'fit5032-66c61' ? { credential: applicationDefault() } : {}) })
const db = getFirestore()
const examples = JSON.parse(await readFile(new URL('../src/assets/json/events.json', import.meta.url), 'utf8'))
let updated = 0
for (const example of examples.filter((event) => ['9', '10', '11', '12'].includes(event.id))) {
  const ref = db.doc(`greenconnect/v1/events/${example.id}`)
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data()
    // Require the expected demo title and old coordinates before changing anything.
    if (current?.isDemo === true && current.title === example.title && current.latitude === -37.81 && current.longitude === 144.96) {
      tx.update(ref, { latitude: example.latitude, longitude: example.longitude })
      updated++
    }
  })
}
console.log(`Updated coordinates for ${updated} matching demonstration activities. Booking data was kept.`)
