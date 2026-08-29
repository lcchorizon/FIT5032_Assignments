<script setup>
import { ref } from 'vue'
import EventList from './components/EventList.vue'
import EventRegistrationForm from './components/EventRegistrationForm.vue'
import RegistrationList from './components/RegistrationList.vue'

const selectedEvent = ref(null)
const savedRegistrations = localStorage.getItem('eventRegistrations')
const registrations = ref(savedRegistrations ? JSON.parse(savedRegistrations) : [])

const selectEvent = (event) => {
  selectedEvent.value = event
}

const addRegistration = (registration) => {
  registrations.value.push(registration)
  localStorage.setItem('eventRegistrations', JSON.stringify(registrations.value))
}

const clearRegistrations = () => {
  registrations.value = []
  localStorage.removeItem('eventRegistrations')
}
</script>

<template>
  <div class="app-shell">
    <header class="hero-section">
      <div class="container py-5">
        <div class="row align-items-center g-4">
          <div class="col-lg-8">
            <p class="hero-label mb-2">Community environmental action</p>
            <h1 class="display-4 fw-bold mb-3">Green Melbourne Community</h1>
            <p class="lead mb-4">
              Find local tree-planting and biodiversity activities across Melbourne.
            </p>
            <a class="btn btn-light btn-lg" href="#events">View community events</a>
          </div>
          <div class="col-lg-4">
            <div class="hero-card">
              <p class="mb-2 fw-semibold">Get involved locally</p>
              <p class="mb-0">
                Explore activities, check event details and register your interest in one place.
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="container py-5">
      <section id="events" class="mb-5">
        <div class="section-heading mb-4">
          <p class="section-label mb-1">Explore activities</p>
          <h2 class="fw-bold mb-2">Community Greening Events</h2>
          <p class="text-secondary mb-0">
            Browse upcoming activities and choose an event that suits your interests.
          </p>
        </div>
        <EventList @select-event="selectEvent" />
      </section>

      <section id="registration" class="mb-5">
        <div class="section-heading mb-4">
          <p class="section-label mb-1">Join an activity</p>
          <h2 class="fw-bold mb-2">Event Registration</h2>
          <p class="text-secondary mb-0">
            Complete the registration form to join a community environmental event.
          </p>
        </div>
        <EventRegistrationForm
          :selected-event="selectedEvent"
          @registration-submitted="addRegistration"
        />
      </section>

      <section id="registrations" class="mb-5">
        <RegistrationList
          :registrations="registrations"
          @clear-registrations="clearRegistrations"
        />
      </section>
    </main>

    <footer class="site-footer py-4">
      <div class="container">
        <p class="mb-0 text-center">Green Melbourne Community</p>
      </div>
    </footer>
  </div>
</template>
