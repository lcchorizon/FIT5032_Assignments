import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'
const config = useEmulators ? {
  apiKey: 'demo-greenconnect-key',
  authDomain: 'demo-greenconnect-a3.firebaseapp.com',
  projectId: 'demo-greenconnect-a3',
  appId: 'demo-greenconnect-app',
} : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(config).every((value) =>
  typeof value === 'string' && value.length > 0 && !value.startsWith('replace-with'))
const app = firebaseConfigured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export const functions = app ? getFunctions(app, import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1') : null

if (app && useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
