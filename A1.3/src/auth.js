import { ref } from 'vue'

const USERS_STORAGE_KEY = 'greenConnectUsers'
const SESSION_STORAGE_KEY = 'greenConnectSession'

const readStoredValue = (key, fallbackValue) => {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallbackValue
  } catch {
    return fallbackValue
  }
}

const storedUsers = readStoredValue(USERS_STORAGE_KEY, [])
const storedSession = readStoredValue(SESSION_STORAGE_KEY, null)

export const users = ref(Array.isArray(storedUsers) ? storedUsers : [])
export const currentUser = ref(storedSession)

const normaliseEmail = (email) => email.trim().toLowerCase()

const createSalt = () => {
  const randomValues = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(randomValues, (value) => value.toString(16).padStart(2, '0')).join('')
}

const hashPassword = async (password, salt) => {
  const passwordData = new TextEncoder().encode(`${salt}:${password}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData)
  return Array.from(new Uint8Array(hashBuffer), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('')
}

const saveUsers = () => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users.value))
}

const createSession = (user) => {
  const sessionUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role
  }

  currentUser.value = sessionUser
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser))
}

export const registerUser = async ({ fullName, email, password }) => {
  const cleanEmail = normaliseEmail(email)
  const emailAlreadyExists = users.value.some((user) => user.email === cleanEmail)

  if (emailAlreadyExists) {
    return { success: false, message: 'An account already exists for this email address.' }
  }

  const salt = createSalt()
  const passwordHash = await hashPassword(password, salt)
  const user = {
    id: crypto.randomUUID(),
    fullName: fullName.trim(),
    email: cleanEmail,
    passwordHash,
    salt,
    role: 'user',
    createdAt: new Date().toISOString()
  }

  users.value.push(user)
  saveUsers()
  createSession(user)

  return { success: true }
}

export const loginUser = async ({ email, password }) => {
  const cleanEmail = normaliseEmail(email)
  const user = users.value.find((storedUser) => storedUser.email === cleanEmail)

  if (!user) {
    return { success: false, message: 'The email address or password is incorrect.' }
  }

  const passwordHash = await hashPassword(password, user.salt)

  if (passwordHash !== user.passwordHash) {
    return { success: false, message: 'The email address or password is incorrect.' }
  }

  createSession(user)
  return { success: true }
}

export const logoutUser = () => {
  currentUser.value = null
  localStorage.removeItem(SESSION_STORAGE_KEY)
}
