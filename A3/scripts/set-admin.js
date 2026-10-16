import { createRequire } from 'node:module'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

const [projectId, uid] = process.argv.slice(2)
if (projectId !== 'fit5032-66c61' || !uid || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Usage: node scripts/set-admin.js fit5032-66c61 <approved-user-uid>')
}
process.env.GOOGLE_CLOUD_QUOTA_PROJECT = projectId
initializeApp({ projectId, credential: applicationDefault() })
const user = await getAuth().getUser(uid)
await getAuth().setCustomUserClaims(uid, { ...user.customClaims, greenconnectAdmin: true })
console.log('GreenConnect admin access was assigned. Log out and log in again to refresh the role.')
