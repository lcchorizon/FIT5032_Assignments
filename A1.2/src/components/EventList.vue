<script setup>
import { computed, ref } from 'vue'
import events from '../assets/json/events.json'

const emit = defineEmits(['select-event'])

const selectedCategory = ref('All')
const familyOnly = ref(false)
const selectedEventId = ref(null)
const searchTerm = ref('')

const categories = [
  'All',
  'Tree Planting',
  'Education',
  'Biodiversity',
  'Habitat Restoration',
  'Plant Care',
  'Community Activity'
]

const filteredEvents = computed(() => {
  return events.filter((event) => {
    const searchText = searchTerm.value.trim().toLowerCase()
    const matchesSearch =
      !searchText ||
      event.title.toLowerCase().includes(searchText) ||
      event.location.toLowerCase().includes(searchText) ||
      event.category.toLowerCase().includes(searchText)
    const matchesCategory =
      selectedCategory.value === 'All' || event.category === selectedCategory.value
    const matchesFamily = !familyOnly.value || event.familyFriendly

    return matchesSearch && matchesCategory && matchesFamily
  })
})

const selectEvent = (event) => {
  selectedEventId.value = event.id
  emit('select-event', event)
}
</script>

<template>
  <div class="event-explorer">
    <aside class="filter-panel">
      <div class="filter-heading">
        <p class="section-label mb-1">Search and filter</p>
        <h3>Find activities near you</h3>
        <p>Search by event name, location or activity type.</p>
      </div>

      <div class="filter-fields">
        <div>
          <label for="eventSearch" class="form-label fw-semibold">Search events</label>
          <input
            id="eventSearch"
            v-model="searchTerm"
            class="form-control"
            type="search"
            placeholder="Try Clayton or planting"
          >
        </div>

        <div>
        <label for="categoryFilter" class="form-label fw-semibold">Activity category</label>
        <select id="categoryFilter" v-model="selectedCategory" class="form-select">
          <option v-for="category in categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </div>

        <div>
        <div class="form-check filter-check">
          <input
            id="familyFilter"
            v-model="familyOnly"
            class="form-check-input"
            type="checkbox"
          >
          <label for="familyFilter" class="form-check-label">Family-friendly activities only</label>
        </div>
      </div>
      </div>

      <div class="filter-summary">
        <p class="result-count mb-1">
          {{ filteredEvents.length }} {{ filteredEvents.length === 1 ? 'event' : 'events' }} found
        </p>
        <p class="mb-0">Select an event to continue to registration.</p>
      </div>
    </aside>

    <div class="event-results">
      <div class="event-results-heading">
        <div>
          <p class="section-label mb-1">Upcoming events</p>
          <h3>Available activities</h3>
        </div>
        <span>{{ filteredEvents.length }} shown</span>
      </div>

      <div class="event-grid">
        <article v-for="event in filteredEvents" :key="event.id" class="event-card">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
          <span class="category-badge">{{ event.category }}</span>
          <span v-if="event.familyFriendly" class="family-badge">Family friendly</span>
        </div>

        <h3 class="h5 fw-bold mb-3">{{ event.title }}</h3>

        <dl class="event-details mb-3">
          <div>
            <dt>Date</dt>
            <dd>{{ event.date }}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{{ event.location }}</dd>
          </div>
          <div>
            <dt>Places available</dt>
            <dd>{{ event.availablePlaces }}</dd>
          </div>
        </dl>

        <p class="text-secondary mb-4">{{ event.description }}</p>

        <button
          type="button"
          class="btn mt-auto"
          :class="selectedEventId === event.id ? 'btn-success' : 'btn-outline-success'"
          @click="selectEvent(event)"
        >
          {{ selectedEventId === event.id ? 'Selected' : 'Select event' }}
        </button>
      </article>

        <div v-if="filteredEvents.length === 0" class="empty-events">
          <h3>No matching activities</h3>
          <p>Try another search, category or remove the family-friendly filter.</p>
        </div>
      </div>
    </div>
  </div>
</template>
