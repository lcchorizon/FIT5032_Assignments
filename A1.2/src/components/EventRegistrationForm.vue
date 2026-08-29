<script setup>
defineProps({
  selectedEvent: {
    type: Object,
    default: null
  }
})
</script>

<template>
  <div class="content-panel">
    <div class="row align-items-center g-3">
      <div class="col-md-8">
        <h3 class="h5 fw-semibold mb-2">
          {{ selectedEvent ? selectedEvent.title : 'Register your interest' }}
        </h3>
        <p v-if="selectedEvent" class="text-secondary mb-0">
          {{ selectedEvent.date }} at {{ selectedEvent.location }}
        </p>
        <p v-else class="text-secondary mb-0">Select an activity above to begin registration.</p>
      </div>
      <div class="col-md-4 text-md-end">
        <span class="status-badge">
          {{ selectedEvent ? 'Event selected' : 'No event selected' }}
        </span>
      </div>
    </div>
  </div>
</template>
