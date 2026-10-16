import { ref } from 'vue'
import { createUserWithEmailAndPassword, getIdTokenResult, onIdTokenChanged,
  signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, firebaseConfigured, functions } from './firebase'
import { errorMessage } from './errors'

export const currentUser = ref(null)
export const authLoading = ref(true)
export const authError = ref('')
let sessionVersion = 0
let pendingProfileName
let sessionTask = Promise.resolve()
let resolveReady
export const authReady = new Promise((resolve) => { resolveReady = resolve })

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
      fullName: profile?.fullName || 'Community member',
      role: token.claims.greenconnectAdmin === true ? 'admin' : 'member',
    }
  }
}

if (firebaseConfigured) {
  onIdTokenChanged(auth, (user) => {
    const version = ++sessionVersion
    if (currentUser.value?.id !== user?.uid) currentUser.value = null
    authLoading.value = true
    authError.value = ''
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

export const registerUser = async ({ fullName, email, password }) => {
  if (!auth) return { success: false, message: authError.value }
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await sessionTask
    try {
      const result = await httpsCallable(functions, 'greenconnectProfile')({ fullName })
      if (auth.currentUser?.uid === credential.user.uid) {
        currentUser.value = result.data
        authError.value = ''
      }
    } catch {
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

export const reconnectUser = async () => {
  if (!auth?.currentUser) return
  authError.value = ''
  try {
    if (pendingProfileName) {
      const result = await httpsCallable(functions, 'greenconnectProfile')({ fullName: pendingProfileName })
      currentUser.value = result.data
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

export const waitForAuth = async () => { await authReady; await sessionTask }
