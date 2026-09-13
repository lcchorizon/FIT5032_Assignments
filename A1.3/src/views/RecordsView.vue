<script setup>
import { ref } from 'vue'
import RegistrationList from '../components/RegistrationList.vue'
import { currentUser } from '../auth'

const savedRegistrations = localStorage.getItem('eventRegistrations')
const registrations = ref(savedRegistrations ? JSON.parse(savedRegistrations) : [])

const clearRegistrations = () => {
  registrations.value = []
  localStorage.removeItem('eventRegistrations')
}
</script>

<template>
  <main class="route-page">
    <section class="container">
      <div class="section-heading">
        <div>
          <p class="section-label mb-2">Admin area</p>
          <h1 class="section-title">Registration records</h1>
        </div>
        <div class="admin-identity">
          <span class="role-badge">{{ currentUser.role }}</span>
          <span>{{ currentUser.fullName }}</span>
        </div>
      </div>
      <p class="section-introduction records-introduction">
        This page contains submitted participant information and is only available to an
        administrator.
      </p>
      <RegistrationList
        :registrations="registrations"
        @clear-registrations="clearRegistrations"
      />
    </section>
  </main>
</template>
