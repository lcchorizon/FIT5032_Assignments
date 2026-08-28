<script setup>
import events from '../assets/json/events.json'
</script>

<template>
  <div class="row g-4">
    <div v-for="event in events" :key="event.id" class="col-12 col-md-6 col-xl-4">
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

        <a class="btn btn-outline-success mt-auto" href="#registration">Register interest</a>
      </article>
    </div>
  </div>
</template>
