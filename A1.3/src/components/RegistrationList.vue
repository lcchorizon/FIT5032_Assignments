<script setup>
import { computed, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const props = defineProps({
  registrations: {
    type: Array,
    required: true
  }
})

defineEmits(['clear-registrations'])

const searchTerm = ref('')

const filteredRegistrations = computed(() => {
  const searchText = searchTerm.value.trim().toLowerCase()

  if (!searchText) return props.registrations

  return props.registrations.filter((registration) => {
    return (
      registration.eventTitle.toLowerCase().includes(searchText) ||
      registration.fullName.toLowerCase().includes(searchText) ||
      registration.email.toLowerCase().includes(searchText)
    )
  })
})
</script>

<template>
  <div class="content-panel records-panel">
    <div class="records-toolbar">
      <div>
        <label for="recordSearch" class="form-label fw-semibold">Search records</label>
        <input
          id="recordSearch"
          v-model="searchTerm"
          class="form-control"
          type="search"
          placeholder="Search by event, name or email"
          :disabled="registrations.length === 0"
        >
      </div>
      <button
        v-if="registrations.length"
        type="button"
        class="btn btn-outline-danger"
        @click="$emit('clear-registrations')"
      >
        Clear records
      </button>
    </div>

    <div v-if="registrations.length" class="table-responsive">
      <DataTable
        :value="filteredRegistrations"
        stripedRows
        paginator
        :rows="5"
        tableStyle="min-width: 50rem"
      >
        <Column field="eventTitle" header="Event" sortable />
        <Column field="fullName" header="Full name" sortable />
        <Column field="email" header="Email" sortable />
        <Column field="participants" header="Participants" sortable />
        <Column field="experienceLevel" header="Experience" sortable />
        <template #empty>No registration records match your search.</template>
      </DataTable>
    </div>

    <div v-else class="empty-records">
      <span>0</span>
      <h3>No registrations yet</h3>
      <p>Select an activity and submit the registration form to create your first record.</p>
    </div>
  </div>
</template>
