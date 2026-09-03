<script setup>
import { useRouter } from 'vue-router'
import { isAuthenticated, logout } from '../auth'

const router = useRouter()

const handleLogout = () => {
  logout()
  router.push('/login')
}
</script>

<template>
  <header class="border-bottom bg-white">
    <div class="container d-flex flex-wrap justify-content-center align-items-center py-3">
      <RouterLink class="navbar-brand me-md-auto" to="/">NoMash Library</RouterLink>
      <ul class="nav nav-pills align-items-center">
        <li class="nav-item">
          <RouterLink class="nav-link" exact-active-class="active" to="/">Home (Week 5)</RouterLink>
        </li>
        <li class="nav-item">
          <RouterLink class="nav-link" active-class="active" to="/about">About</RouterLink>
        </li>
        <li v-if="!isAuthenticated" class="nav-item">
          <RouterLink class="nav-link" active-class="active" to="/login">Login</RouterLink>
        </li>
        <li v-else class="nav-item ms-2">
          <button class="btn btn-outline-secondary" type="button" @click="handleLogout">Logout</button>
        </li>
      </ul>
    </div>
  </header>
</template>
