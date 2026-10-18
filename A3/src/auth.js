// Keep the Firebase login state in one place so every page uses the same account and role.
import { ref } from 'vue'
import { createUserWithEmailAndPassword, getIdTokenResult, onIdTokenChanged,
  reload, sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, firebaseConfigured, functions } from './firebase'
import { errorMessage } from './errors'

export const currentUser = ref(null)
export const authLoading = ref(true)
export const authError = ref('')
// A login request can finish after logout or an account switch.
// The version number prevents its old result from restoring the wrong account.
let sessionVersion = 0
let pendingProfileName
let sessionTask = Promise.resolve()
let resolveReady
export const authReady = new Promise((resolve) => { resolveReady = resolve })

// The custom claim comes from the signed token. An editable profile field cannot grant admin access.
const loadUser = async (user, version) => {
  if (!user) {
    currentUser.value = null
    return
  }
  const token = await getIdTokenResult(user)
  let profile = null
  try {
    profile = (await httpsCallable(functions, 'greenconnectProfile')({})).data
  } catch {
    if (version === sessionVersion) {
      authError.value = 'You are logged in, but your profile could not be loaded. Try reconnecting.'
    }
  }
  if (version === sessionVersion && auth.currentUser?.uid === user.uid) {
    currentUser.value = {
      id: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      fullName: profile?.fullName || 'Community member',
      role: token.claims.greenconnectAdmin === true ? 'admin' : 'member',
    }
  }
}

if (firebaseConfigured) {
  // This also runs when a saved login is restored or the token refreshes.
  // Pages wait for this initial check before deciding whether to redirect.
  onIdTokenChanged(auth, (user) => {
    const version = ++sessionVersion
    if (currentUser.value?.id !== user?.uid) currentUser.value = null
    authLoading.value = true
    authError.value = ''
    // Keep the current profile-loading task so callers can wait until account state is ready.
    sessionTask = (async () => {
      try {
        await loadUser(user, version)
      } catch (error) {
        if (version === sessionVersion) authError.value = errorMessage(error)
      } finally {
        if (version === sessionVersion) {
          authLoading.value = false
          resolveReady()
        }
      }
    })()
  }, (error) => {
    currentUser.value = null
    authError.value = errorMessage(error)
    authLoading.value = false
    resolveReady()
  })
} else {
  authError.value = 'Account services are not configured yet.'
  authLoading.value = false
  resolveReady()
}

// Firebase Authentication handles the password. It is never written to Firestore.
export const registerUser = async ({ fullName, email, password }) => {
  if (!auth) return { success: false, message: authError.value }
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await sessionTask
    try {
      const result = await httpsCallable(functions, 'greenconnectProfile')({ fullName })
      if (auth.currentUser?.uid === credential.user.uid) {
        currentUser.value = { ...result.data, emailVerified: credential.user.emailVerified }
        authError.value = ''
      }
    } catch {
      // Account creation already succeeded. Keep the unsaved name for Reconnect instead of creating another account.
      pendingProfileName = fullName
      authError.value = 'Your account was created, but your name could not be saved. Use Reconnect to try again.'
      return { success: true, message: 'Your account was created. Your profile could not be updated; use Reconnect to try again.' }
    }
    return { success: true }
  } catch (error) {
    return { success: false, message: errorMessage(error) }
  }
}

export const loginUser = async ({ email, password }) => {
  if (!auth) return { success: false, message: authError.value }
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
    await sessionTask
    await loadUser(credential.user, sessionVersion)
    return { success: true }
  } catch (error) {
    return { success: false, message: errorMessage(error) }
  }
}

// Retry a profile failure without asking the member to register again.
export const reconnectUser = async () => {
  if (!auth?.currentUser) return
  authError.value = ''
  try {
    if (pendingProfileName) {
      const result = await httpsCallable(functions, 'greenconnectProfile')({ fullName: pendingProfileName })
      currentUser.value = { ...result.data, emailVerified: auth.currentUser.emailVerified }
      pendingProfileName = undefined
    } else {
      await loadUser(auth.currentUser, sessionVersion)
    }
  } catch (error) {
    authError.value = errorMessage(error)
  }
}

export const logoutUser = async () => {
  if (!auth) return
  await signOut(auth)
  pendingProfileName = undefined
  ++sessionVersion
  currentUser.value = null
  authLoading.value = false
}

export const userHasRole = (role) => currentUser.value?.role === role

export const verifyAccountEmail = async () => {
  if (!auth?.currentUser) throw new Error('Please log in to continue.')
  await sendEmailVerification(auth.currentUser)
}

// Reload the Auth account, then refresh the token so the UI can see the verified email state.
export const refreshEmailVerification = async () => {
  const user = auth?.currentUser
  if (!user) return
  await reload(user)
  await user.getIdToken(true)
  await sessionTask
  if (auth.currentUser?.uid === user.uid) await loadUser(user, sessionVersion)
  return user.emailVerified
}

export const waitForAuth = async () => { await authReady; await sessionTask }
