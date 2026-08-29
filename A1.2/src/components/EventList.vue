<script setup>
import { computed, ref } from 'vue'
import events from '../assets/json/events.json'

const emit = defineEmits(['select-event'])

const selectedCategory = ref('All')
const familyOnly = ref(false)
const selectedEventId = ref(null)

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
    const matchesCategory =
      selectedCategory.value === 'All' || event.category === selectedCategory.value
    const matchesFamily = !familyOnly.value || event.familyFriendly

    return matchesCategory && matchesFamily
  })
})

const selectEvent = (event) => {
  selectedEventId.value = event.id
  emit('select-event', event)
}
</script>

<template>
  <div class="filter-panel mb-4">
    <div class="row align-items-end g-3">
      <div class="col-md-7 col-lg-5">
        <label for="categoryFilter" class="form-label fw-semibold">Activity category</label>
        <select id="categoryFilter" v-model="selectedCategory" class="form-select">
          <option v-for="category in categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </div>

      <div class="col-md-5 col-lg-4">
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

      <div class="col-lg-3 text-lg-end">
        <p class="result-count mb-0">
          {{ filteredEvents.length }} {{ filteredEvents.length === 1 ? 'event' : 'events' }} found
        </p>
      </div>
    </div>
  </div>

  <div class="row g-4">
    <div
      v-for="event in filteredEvents"
      :key="event.id"
      class="col-12 col-md-6 col-xl-4"
    >
      <article class="event-card h-100">
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
    </div>
  </div>

  <div v-if="filteredEvents.length === 0" class="content-panel text-center">
    <h3 class="h5 fw-semibold mb-2">No matching activities</h3>
    <p class="text-secondary mb-0">Try another category or remove the family-friendly filter.</p>
  </div>
</template>
