<script setup>
// Load public events and pass them to the reusable table with event columns.
import InteractiveTable from '../components/InteractiveTable.vue'
import { useCollection } from '../data'
import { eventColumns } from '../tableColumns'
const { rows: events, loading, error } = useCollection('events', { sort: 'startAt' })
</script>

<template>
  <main id="main-content" class="route-page" tabindex="-1">
    <section class="container">
      <div class="section-heading">
        <div><p class="section-label mb-2">Explore activities</p><h1 class="section-title">Event directory</h1></div>
        <RouterLink class="btn btn-success" :to="{ name: 'calendar' }">Open calendar to book</RouterLink>
      </div>
      <p class="section-introduction mb-4">Compare activities, search by a particular column and export the results you need.</p>
      <p v-if="loading" role="status">Loading events…</p>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <InteractiveTable v-if="!loading && !error" id="events" title="Community events" :columns="eventColumns" :rows="events" description="Demonstration community activities. Dates and times use Melbourne time. Availability can change before your booking is confirmed." />
      <RouterLink class="btn btn-link mt-3" :to="{ name: 'home', hash: '#events' }">Browse activity cards</RouterLink>
      <RouterLink class="btn btn-link mt-3" :to="{ name: 'map' }">Find activities on the map</RouterLink>
    </section>
  </main>
</template>
