<script setup>
// Admin records page. Fictional examples are kept separate from saved Firestore bookings.
import { computed, ref } from 'vue'
import examples from '../assets/json/registration-examples.json'
import RegistrationList from '../components/RegistrationList.vue'
import { currentUser } from '../auth'
import { useCollection } from '../data'
const { rows: registrations, loading, error } = useCollection('registrations', { admin: true })
const source = ref('saved')
// Examples are bundled fictional data. Switching this view never writes fake bookings into Firestore.
const displayedRows = computed(() => source.value === 'examples' ? examples : registrations.value)
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
      <div class="records-source mb-4">
        <RouterLink class="btn btn-outline-success mb-3" :to="{ name: 'dashboard' }">Open admin dashboard</RouterLink>
        <label for="recordSource" class="form-label fw-semibold">Record source</label>
        <select id="recordSource" v-model="source" class="form-select">
          <option value="saved">Saved bookings</option>
          <option value="examples">Demonstration records (fictional)</option>
        </select>
      </div>
      <p v-if="loading && source === 'saved'" role="status">Loading registration records…</p>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <RegistrationList v-if="source === 'examples' || (!loading && !error)"
        :key="source" :registrations="displayedRows" :examples="source === 'examples'"
      />
    </section>
  </main>
</template>
