import { ref } from 'vue'

export const isAuthenticated = ref(false)

export const login = (username, password) => {
  const credentialsAreValid = username === 'member' && password === 'Library123!'
  isAuthenticated.value = credentialsAreValid
  return credentialsAreValid
}

export const logout = () => {
  isAuthenticated.value = false
}
