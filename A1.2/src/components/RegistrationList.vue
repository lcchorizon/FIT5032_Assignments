<script setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

defineProps({
  registrations: {
    type: Array,
    required: true
  }
})

defineEmits(['clear-registrations'])
</script>

<template>
  <div v-if="registrations.length" class="content-panel">
    <div class="registration-list-heading mb-4">
      <div>
        <p class="section-label mb-1">Submitted data</p>
        <h2 class="h3 fw-bold mb-2">Registration Records</h2>
        <p class="text-secondary mb-0">
          Submitted registrations are saved in this browser.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-outline-danger"
        @click="$emit('clear-registrations')"
      >
        Clear records
      </button>
    </div>

    <div class="table-responsive">
      <DataTable :value="registrations" stripedRows tableStyle="min-width: 50rem">
        <Column field="eventTitle" header="Event" />
        <Column field="fullName" header="Full name" />
        <Column field="email" header="Email" />
        <Column field="participants" header="Participants" />
        <Column field="experienceLevel" header="Experience" />
      </DataTable>
    </div>
  </div>
</template>
