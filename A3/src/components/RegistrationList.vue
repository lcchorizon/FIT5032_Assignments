<script setup>
import { userHasRole } from '../auth'
import { registrationColumns } from '../tableColumns'
import InteractiveTable from './InteractiveTable.vue'

defineProps({
  registrations: { type: Array, required: true },
  examples: { type: Boolean, default: false },
})
const canExport = () => userHasRole('admin')
</script>

<template>
  <InteractiveTable
    :id="examples ? 'registration-examples' : 'registrations'"
    :title="examples ? 'Demonstration registration records' : 'Saved registration records'"
    :rows="registrations" :columns="registrationColumns" :can-export="canExport"
    :description="examples ? 'Fictional example records for trying searches, pagination and exports. These records do not reserve places.' : 'Participant information is available to administrators only. Dates and times use Melbourne time.'"
  />
</template>
