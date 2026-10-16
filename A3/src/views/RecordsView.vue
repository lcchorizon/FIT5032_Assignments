<script setup>
import RegistrationList from '../components/RegistrationList.vue'
import { currentUser } from '../auth'
import { useCollection } from '../data'
const { rows: registrations, loading, error } = useCollection('registrations', { admin: true })
</script>

<template>
  <main id="main-content" class="route-page" tabindex="-1">
    <section class="container">
      <div class="section-heading">
        <div>
          <p class="section-label mb-2">Admin area</p>
          <h1 class="section-title">Registration records</h1>
        </div>
        <div class="admin-identity">
          <span class="role-badge">{{ currentUser?.role }}</span>
          <span>{{ currentUser?.fullName }}</span>
        </div>
      </div>
      <p class="section-introduction records-introduction">
        This page contains submitted participant information and is only available to an
        administrator.
      </p>
      <p v-if="loading" role="status">Loading registration records…</p>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <RegistrationList v-if="!loading && !error"
        :registrations="registrations"
      />
    </section>
  </main>
</template>
