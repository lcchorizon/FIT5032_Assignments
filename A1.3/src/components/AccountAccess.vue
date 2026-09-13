<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { currentUser, loginUser, logoutUser, registerUser } from '../auth'

const route = useRoute()
const router = useRouter()
const mode = ref('login')
const isSubmitting = ref(false)
const formData = ref({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: ''
})
const errors = ref({})
const statusMessage = ref('')

const clearForm = () => {
  formData.value = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  }
  errors.value = {}
}

const changeMode = (newMode) => {
  mode.value = newMode
  statusMessage.value = ''
  clearForm()
}

const validateForm = () => {
  const newErrors = {}
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (mode.value === 'register' && formData.value.fullName.trim().length < 3) {
    newErrors.fullName = 'Full name must be at least 3 characters.'
  }

  if (!emailPattern.test(formData.value.email.trim())) {
    newErrors.email = 'Enter a valid email address.'
  }

  if (formData.value.password.length < 8) {
    newErrors.password = 'Password must be at least 8 characters.'
  } else if (!/[A-Za-z]/.test(formData.value.password) || !/\d/.test(formData.value.password)) {
    newErrors.password = 'Password must include at least one letter and one number.'
  }

  if (
    mode.value === 'register' &&
    formData.value.confirmPassword !== formData.value.password
  ) {
    newErrors.confirmPassword = 'Passwords do not match.'
  }

  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

const submitForm = async () => {
  statusMessage.value = ''

  if (!validateForm()) return

  isSubmitting.value = true

  try {
    const result =
      mode.value === 'register'
        ? await registerUser(formData.value)
        : await loginUser(formData.value)

    if (!result.success) {
      errors.value = { account: result.message }
      return
    }

    statusMessage.value =
      mode.value === 'register'
        ? 'Your account has been created and you are now logged in.'
        : 'You are now logged in.'
    clearForm()

    if (mode.value === 'login' && typeof route.query.redirect === 'string') {
      router.push(route.query.redirect)
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleLogout = () => {
  logoutUser()
  changeMode('login')
  statusMessage.value = 'You have been logged out.'
}
</script>

<template>
  <div class="account-access">
    <div class="account-introduction">
      <p class="section-label mb-2">MEMBER ACCESS</p>
      <h3>Keep your activity details together</h3>
      <p>
        Create an account to use member features. Your account is stored in this browser for this
        client-side application.
      </p>
      <ul class="account-benefits">
        <li>Register with your own email address</li>
        <li>Return and log in again later</li>
        <li>Log out when you finish using the application</li>
      </ul>
    </div>

    <div class="content-panel account-panel">
      <div v-if="currentUser" class="signed-in-panel">
        <span class="account-status">Logged in</span>
        <h3>Welcome, {{ currentUser.fullName }}</h3>
        <p class="mb-1"><strong>Email:</strong> {{ currentUser.email }}</p>
        <p><strong>Role:</strong> <span class="role-badge">{{ currentUser.role }}</span></p>
        <p class="text-secondary">Your login will remain available when this page is refreshed.</p>
        <div v-if="statusMessage" class="alert alert-success" role="status">
          {{ statusMessage }}
        </div>
        <button type="button" class="btn btn-outline-secondary" @click="handleLogout">
          Log out
        </button>
      </div>

      <template v-else>
        <div class="auth-mode-switch" aria-label="Choose login or registration">
          <button
            type="button"
            :class="{ active: mode === 'login' }"
            @click="changeMode('login')"
          >
            Log in
          </button>
          <button
            type="button"
            :class="{ active: mode === 'register' }"
            @click="changeMode('register')"
          >
            Create account
          </button>
        </div>

        <h3>{{ mode === 'login' ? 'Member login' : 'Create your account' }}</h3>
        <p class="text-secondary">
          {{
            mode === 'login'
              ? 'Enter the details you used when creating your account.'
              : 'All new accounts are created as community members.'
          }}
        </p>

        <form novalidate @submit.prevent="submitForm">
          <div v-if="route.query.reason === 'login-required'" class="alert alert-warning">
            Please log in before opening the protected Records page.
          </div>
          <div v-if="mode === 'register'" class="mb-3">
            <label for="accountFullName" class="form-label">Full name</label>
            <input
              id="accountFullName"
              v-model="formData.fullName"
              class="form-control"
              :class="{ 'is-invalid': errors.fullName }"
              type="text"
              autocomplete="name"
            >
            <div v-if="errors.fullName" class="invalid-feedback">{{ errors.fullName }}</div>
          </div>

          <div class="mb-3">
            <label for="accountEmail" class="form-label">Email address</label>
            <input
              id="accountEmail"
              v-model="formData.email"
              class="form-control"
              :class="{ 'is-invalid': errors.email }"
              type="email"
              autocomplete="email"
            >
            <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
          </div>

          <div class="mb-3">
            <label for="accountPassword" class="form-label">Password</label>
            <input
              id="accountPassword"
              v-model="formData.password"
              class="form-control"
              :class="{ 'is-invalid': errors.password }"
              type="password"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            >
            <div v-if="errors.password" class="invalid-feedback">{{ errors.password }}</div>
          </div>

          <div v-if="mode === 'register'" class="mb-3">
            <label for="confirmAccountPassword" class="form-label">Confirm password</label>
            <input
              id="confirmAccountPassword"
              v-model="formData.confirmPassword"
              class="form-control"
              :class="{ 'is-invalid': errors.confirmPassword }"
              type="password"
              autocomplete="new-password"
            >
            <div v-if="errors.confirmPassword" class="invalid-feedback">
              {{ errors.confirmPassword }}
            </div>
          </div>

          <div v-if="errors.account" class="alert alert-danger" role="alert">
            {{ errors.account }}
          </div>
          <div v-if="statusMessage" class="alert alert-success" role="status">
            {{ statusMessage }}
          </div>

          <button type="submit" class="btn btn-success w-100" :disabled="isSubmitting">
            {{ mode === 'login' ? 'Log in' : 'Create account' }}
          </button>

          <p v-if="mode === 'login'" class="demo-account-note mb-0">
            Admin demo: admin@greenconnect.org / Admin123!
          </p>
        </form>
      </template>
    </div>
  </div>
</template>
