<script setup>
import { ref } from 'vue'
import EventList from './components/EventList.vue'
import EventRegistrationForm from './components/EventRegistrationForm.vue'
import RegistrationList from './components/RegistrationList.vue'

const selectedEvent = ref(null)
const menuOpen = ref(false)
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

const closeMenu = () => {
  menuOpen.value = false
}
</script>

<template>
  <div class="app-shell">
    <header id="home" class="site-header">
      <nav class="main-navigation" aria-label="Main navigation">
        <div class="container navigation-inner">
          <a class="brand" href="#home" @click="closeMenu">
            <span class="brand-mark">G</span>
            <span>GreenConnect</span>
          </a>

          <button
            type="button"
            class="menu-button"
            :aria-expanded="menuOpen"
            aria-controls="navigationLinks"
            @click="menuOpen = !menuOpen"
          >
            Menu
          </button>

          <div id="navigationLinks" class="navigation-links" :class="{ open: menuOpen }">
            <a href="#home" @click="closeMenu">Home</a>
            <a href="#events" @click="closeMenu">Events</a>
            <a href="#registration" @click="closeMenu">Get involved</a>
            <a href="#registrations" @click="closeMenu">Records</a>
            <a class="navigation-action" href="#events" @click="closeMenu">Find an event</a>
          </div>
        </div>
      </nav>

      <div class="hero-section">
        <div class="container hero-layout">
          <div class="hero-content">
            <p class="hero-label mb-3"></p>
            <h1 class="hero-title">Small local actions can grow into a greener Melbourne.</h1>
            <p class="hero-description">
              Discover community planting, biodiversity and nature activities. Choose an event
              that suits you and register in a few simple steps.
            </p>
            <div class="hero-actions">
              <a class="btn btn-light btn-lg" href="#events">Explore events</a>
              <a class="hero-link" href="#registration">How registration works</a>
            </div>
          </div>

         
        </div>
      </div>
    </header>

    <main>
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
              <p>Your submitted registration will appear in the records section below.</p>
            </aside>

            <EventRegistrationForm
              :selected-event="selectedEvent"
              @registration-submitted="addRegistration"
            />
          </div>
        </div>
      </section>

      <section id="registrations" class="page-section">
        <div class="container">
          <div class="section-heading">
            <div>
              <p class="section-label mb-2">Submitted data</p>
              <h2 class="section-title">Registration records</h2>
            </div>
            <p class="section-introduction">
              Review and search the registrations saved in this browser.
            </p>
          </div>

          <RegistrationList
            :registrations="registrations"
            @clear-registrations="clearRegistrations"
          />
        </div>
      </section>

      <section class="community-banner">
        <div class="container community-banner-inner">
          <div>
            <p class="section-label light-label mb-2">Start with one event</p>
            <h2 class="mb-0">Meet people and support your local environment.</h2>
          </div>
          <a class="btn btn-light" href="#events">Browse activities</a>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-layout">
        <div>
          <p class="footer-brand mb-1">GreenConnect</p>
          <p class="mb-0">Community environmental activities across Melbourne.</p>
        </div>
        <div class="footer-links">
          <a href="#events">Events</a>
          <a href="#registration">Register</a>
          <a href="#registrations">Records</a>
        </div>
      </div>
    </footer>
  </div>
</template>
