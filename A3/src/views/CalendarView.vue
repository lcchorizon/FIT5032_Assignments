<script setup>
// Connect the calendar, booking form and personal bookings on a separate page.
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCollection } from '../data'
import EventCalendar from '../components/EventCalendar.vue'
import EventRegistrationForm from '../components/EventRegistrationForm.vue'
import MyBookings from '../components/MyBookings.vue'

const route = useRoute()
const { rows: events, loading, error } = useCollection('events', { sort: 'startAt' })
// Read the event query parameter so map and directory links can open a particular activity.
const selectedId = ref(typeof route.query.event === 'string' ? route.query.event : null)
const selectedEvent = computed(() => events.value.find((event) => event.id === selectedId.value) || null)
const bookingPanel = ref(null)
const selectEvent = async (event) => {
  selectedId.value = event.id
  // Wait for Vue to update the selected form, then move focus to it for keyboard users.
  await nextTick()
  bookingPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  bookingPanel.value?.focus({ preventScroll: true })
}
watch(() => route.query.event, (eventId) => {
  if (typeof eventId === 'string') selectedId.value = eventId
})
</script>

<template>
  <main id="main-content" class="route-page" tabindex="-1">
    <section class="container">
      <div class="section-heading">
        <div><p class="section-label mb-2">Plan your next activity</p><h1 class="section-title">Activity calendar</h1></div>
        <a href="#my-bookings" class="btn btn-outline-success">My bookings</a>
      </div>
      <p class="section-introduction mb-4">Choose a date and an activity. Your booking is confirmed after the available places and your other bookings have been checked.</p>
      <p class="text-secondary">These are demonstration community activities.</p>
      <p v-if="loading" role="status">Loading the activity calendar…</p>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <EventCalendar v-if="!loading && !error" :events="events" :selected-event-id="selectedId" @select-event="selectEvent" />
      <section ref="bookingPanel" class="calendar-booking-panel" tabindex="-1" aria-label="Book the selected activity">
        <EventRegistrationForm :selected-event="selectedEvent" />
      </section>
    </section>
    <MyBookings />
  </main>
</template>
