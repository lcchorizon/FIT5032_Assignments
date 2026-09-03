<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '../auth'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')

const handleLogin = () => {
  if (!login(username.value, password.value)) {
    error.value = 'The username or password is incorrect.'
    return
  }

  const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : '/about'
  router.push(redirectPath)
}
</script>

<template>
  <section class="container page-panel login-panel">
    <h1 class="text-center mb-4">Member Login</h1>
    <div v-if="route.query.reason === 'denied'" class="alert alert-warning">
      Access denied. Please log in to open the About page.
    </div>
    <form @submit.prevent="handleLogin">
      <div class="mb-3">
        <label class="form-label" for="login-username">Username</label>
        <input id="login-username" v-model="username" class="form-control" type="text" required>
      </div>
      <div class="mb-3">
        <label class="form-label" for="login-password">Password</label>
        <input id="login-password" v-model="password" class="form-control" type="password" required>
      </div>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <button class="btn btn-primary w-100" type="submit">Login</button>
    </form>
    <p class="text-muted small mt-3 mb-0">Test login: member / Library123!</p>
  </section>
</template>
