<script setup>
import { ref } from 'vue'
import AccountAccess from '../components/AccountAccess.vue'
import EventList from '../components/EventList.vue'
import EventRegistrationForm from '../components/EventRegistrationForm.vue'

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
</script>

<template>
  <header id="home" class="site-header">
    <div class="hero-section">
      <div class="container hero-layout">
        <div class="hero-content">
          <p class="hero-label mb-3"></p>
          <h1 class="hero-title">Small local actions can grow into a greener Melbourne.</h1>
          <p class="hero-description">
            Discover community planting, biodiversity and nature activities. Choose an event that
            suits you and register in a few simple steps.
          </p>
          <div class="hero-actions">
            <RouterLink class="btn btn-light btn-lg" :to="{ name: 'home', hash: '#events' }">
              Explore events
            </RouterLink>
            <RouterLink class="hero-link" :to="{ name: 'home', hash: '#registration' }">
              How registration works
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main>
    <section id="account" class="page-section section-soft account-section">
      <div class="container">
        <div class="section-heading">
          <div>
            <p class="section-label mb-2">Your account</p>
            <h2 class="section-title">Join the GreenConnect community</h2>
          </div>
          <p class="section-introduction">
            Register a new account or log in with an account saved in this browser.
          </p>
        </div>
        <AccountAccess />
      </div>
    </section>

    <section id="events" class="page-section">
      <div class="container">
        <div class="section-heading">
          <div>
            <p class="section-label mb-2">Explore activities</p>
            <h2 class="section-title">Find your next community event</h2>
          </div>
          <p class="section-introduction">
            Browse upcoming activities and narrow the list by interest or family suitability.
          </p>
        </div>
        <EventList @select-event="selectEvent" />
      </div>
    </section>

    <section id="registration" class="page-section section-soft">
      <div class="container">
        <div class="section-heading">
          <div>
            <p class="section-label mb-2">Join an activity</p>
            <h2 class="section-title">Complete your registration</h2>
          </div>
          <p class="section-introduction">
            Select an event first, then provide the details needed for your booking.
          </p>
        </div>

        <div class="registration-layout">
          <aside class="registration-guide">
            <p class="guide-number">01</p>
            <h3>Choose an activity</h3>
            <p>Return to the event list if you have not selected an activity yet.</p>
            <p class="guide-number">02</p>
            <h3>Enter your details</h3>
            <p>Complete every required field and check the event information.</p>
            <p class="guide-number">03</p>
            <h3>Keep your record</h3>
            <p>An administrator can review submitted records on the protected Records page.</p>
          </aside>

          <EventRegistrationForm
            :selected-event="selectedEvent"
            @registration-submitted="addRegistration"
          />
        </div>
      </div>
    </section>

    <section class="community-banner">
      <div class="container community-banner-inner">
        <div>
          <p class="section-label light-label mb-2">Start with one event</p>
          <h2 class="mb-0">Meet people and support your local environment.</h2>
        </div>
        <RouterLink class="btn btn-light" :to="{ name: 'home', hash: '#events' }">
          Browse activities
        </RouterLink>
      </div>
    </section>
  </main>
</template>
