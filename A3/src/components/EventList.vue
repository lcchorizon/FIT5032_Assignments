<script setup>
// Browse the live event cards, combine filters and submit the current member's rating.
import { computed, ref, watch } from 'vue'
import { useCollection, useOwnRatings, saveRating } from '../data'
import { errorMessage } from '../errors'
import { eventTime } from '../eventDates'
import { currentUser } from '../auth'

const emit = defineEmits(['select-event'])

const selectedCategory = ref('All')
const familyOnly = ref(false)
const selectedEventId = ref(null)
const searchTerm = ref('')
const ratingMessageEventId = ref(null)
const { rows: events, loading, error } = useCollection('events', { sort: 'startAt' })
const { ratings, error: ratingsError } = useOwnRatings(events)
const ratingError = ref('')
const savingRating = ref(null)
const ratingOptions = [1, 2, 3, 4, 5]

const categories = [
  'All',
  'Tree Planting',
  'Education',
  'Biodiversity',
  'Habitat Restoration',
  'Plant Care',
  'Community Activity'
]

// All active filters combine; changing one filter does not remove the others.
const filteredEvents = computed(() => {
  return events.value.filter((event) => {
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

// Refresh the selected activity in the parent when live availability changes.
watch(events, (updated) => {
  const selected = updated.find((event) => event.id === selectedEventId.value)
  if (selected) emit('select-event', selected)
})

const getAverageRating = (event) => event.ratingCount ? (event.ratingTotal / event.ratingCount).toFixed(1) : null
const getUserRating = (eventId) => ratings.value[eventId] || 0
// The backend uses one document per user and event, so changing a score updates the existing vote.
const rateEvent = async (eventId, score) => {
  if (!currentUser.value || savingRating.value) return
  savingRating.value = eventId
  ratingError.value = ''
  ratingMessageEventId.value = null
  try {
    await saveRating(eventId, score)
    ratingMessageEventId.value = eventId
  } catch (error) {
    ratingError.value = errorMessage(error)
  } finally {
    savingRating.value = null
  }
}
</script>

<template>
  <p v-if="loading" role="status">Loading upcoming events…</p>
  <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
  <p v-if="ratingError || ratingsError" class="alert alert-danger" role="alert">{{ ratingError || ratingsError }}</p>
  <p class="text-secondary">These are demonstration community activities.</p>
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
            <dd>{{ eventTime(event.startAt, event.endAt) }}</dd>
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

        <section class="event-rating" :aria-label="'Rating for ' + event.title">
          <div class="rating-summary">
            <span>Community rating</span>
            <strong v-if="getAverageRating(event)">
              {{ getAverageRating(event) }} / 5
              <small>
                ({{ event.ratingCount }}
                {{ event.ratingCount === 1 ? 'rating' : 'ratings' }})
              </small>
            </strong>
            <strong v-else>No ratings yet</strong>
          </div>

          <div class="rating-buttons" aria-label="Choose a rating from 1 to 5">
            <button
              v-for="score in ratingOptions"
              :key="score"
              type="button"
              :class="{ selected: score <= getUserRating(event.id) }"
              :disabled="!currentUser || savingRating === event.id"
              :aria-label="'Rate ' + event.title + ' ' + score + ' out of 5'"
              @click="rateEvent(event.id, score)"
            >
              ★
            </button>
          </div>

          <p v-if="currentUser" class="rating-help">
            {{
              getUserRating(event.id)
                ? 'Your rating: ' + getUserRating(event.id) + ' / 5'
                : 'Choose your rating.'
            }}
          </p>
          <p v-else class="rating-help">Log in to rate this activity.</p>
          <p v-if="ratingMessageEventId === event.id" class="rating-status" role="status">
            Your rating was saved.
          </p>
        </section>

        <button
          type="button"
          class="btn mt-auto"
          :class="selectedEventId === event.id ? 'btn-success' : 'btn-outline-success'"
          @click="selectEvent(event)"
        >
          {{ selectedEventId === event.id ? 'Selected' : 'Select event' }}
        </button>
      </article>

        <div v-if="!loading && !error && filteredEvents.length === 0" class="empty-events">
          <h3>No matching activities</h3>
          <p>Try another search, category or remove the family-friendly filter.</p>
        </div>
      </div>
    </div>
  </div>
</template>
