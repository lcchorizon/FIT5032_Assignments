<script setup>
// One table component supports both public events and private admin registration records.
import { computed, onScopeDispose, ref, watch } from 'vue'
import { cellText, filterTable, sortTable, tableCsv, tablePage, tableSummary } from '../tableData'
import { downloadFile } from '../download'
import { melbourneDay } from '../eventDates'

const props = defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
  rows: { type: Array, required: true },
  columns: { type: Array, required: true },
  description: { type: String, default: '' },
  canExport: { type: Function, default: () => true },
})
const search = ref('')
const filters = ref({})
const sortKey = ref(props.columns[0]?.key)
const sortDirection = ref('asc')
const requestedPage = ref(1)
const exporting = ref(false)
const status = ref('')
const exportError = ref('')
let active = true
onScopeDispose(() => { active = false })
// The data flow is filter -> sort -> page. Exports use sorted rows before pagination.
const filtered = computed(() => filterTable(props.rows, props.columns, search.value, filters.value))
const sorted = computed(() => sortTable(filtered.value, props.columns, sortKey.value, sortDirection.value))
const pagination = computed(() => tablePage(sorted.value, requestedPage.value))
const summary = computed(() => tableSummary(props.columns, search.value, filters.value, sortKey.value, sortDirection.value))
const start = computed(() => sorted.value.length ? (pagination.value.page - 1) * 10 + 1 : 0)
const end = computed(() => Math.min(pagination.value.page * 10, sorted.value.length))
// A new search or sort starts at page one and clears messages from the previous export.
watch([search, filters, sortKey, sortDirection], () => { requestedPage.value = 1; status.value = ''; exportError.value = '' }, { deep: true })
watch(() => pagination.value.page, (page) => { requestedPage.value = page })
const sort = (key) => {
  sortDirection.value = sortKey.value === key && sortDirection.value === 'asc' ? 'desc' : 'asc'
  sortKey.value = key
}
const clear = () => { search.value = ''; filters.value = {} }
const exportRows = async (format) => {
  if (!props.canExport() || !sorted.value.length || exporting.value) return
  // Take a snapshot so a later filter change does not alter an export already being prepared.
  const rows = [...sorted.value]
  const currentSummary = summary.value
  exporting.value = true
  status.value = ''
  exportError.value = ''
  try {
    if (format === 'csv') {
      downloadFile(tableCsv(rows, props.columns), 'text/csv;charset=utf-8', `greenconnect-${props.id}-${melbourneDay()}.csv`)
    } else {
      // Load the larger PDF module only when requested. Recheck access after asynchronous work.
      const { createTablePdf } = await import('../pdfExport')
      if (!active || !props.canExport()) return
      const result = await createTablePdf({ title: props.title, rows, columns: props.columns, description: props.description, summary: currentSummary })
      if (!active || !props.canExport()) return
      downloadFile(result.bytes, 'application/pdf', `greenconnect-${props.id}-${melbourneDay()}.pdf`)
      if (result.replacements) status.value = 'Some symbols are shown as ? in the PDF. CSV keeps the original text. '
    }
    status.value += `${format.toUpperCase()} download prepared with ${rows.length} matching record(s).`
  } catch (error) {
    if (active) exportError.value = error.message || 'The export could not be prepared. Please try again.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section class="content-panel interactive-table" :aria-labelledby="`${id}-heading`">
    <h2 :id="`${id}-heading`" class="h4">{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <div class="table-toolbar">
      <div class="table-search">
        <label :for="`${id}-search`" class="form-label fw-semibold">Search all columns</label>
        <input :id="`${id}-search`" v-model="search" type="search" class="form-control" maxlength="100" placeholder="Search these records">
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-end">
        <button class="btn btn-outline-secondary" type="button" @click="clear">Clear filters</button>
        <button class="btn btn-outline-success" type="button" :disabled="!sorted.length || exporting || !canExport()" @click="exportRows('csv')">Export CSV</button>
        <button class="btn btn-success" type="button" :disabled="!sorted.length || exporting || !canExport()" @click="exportRows('pdf')">{{ exporting ? 'Preparing export…' : 'Export PDF' }}</button>
      </div>
    </div>
    <p :id="`${id}-export-help`" class="table-export-help">Exports include all matching records in the current sort order, across every page.</p>
    <p v-if="status" class="alert alert-success" role="status">{{ status }}</p>
    <p v-if="exportError" class="alert alert-danger" role="alert">{{ exportError }}</p>
    <p class="table-result-count" aria-live="polite">Showing {{ start }}–{{ end }} of {{ sorted.length }} matching records ({{ rows.length }} total).</p>
    <div class="table-scroll-region" role="region" :aria-label="`${title}, scroll horizontally for more columns`" tabindex="0">
      <table class="records-data-table">
        <caption class="visually-hidden">{{ title }}. Ten rows per page. Use the column headings to sort and the fields below them to filter.</caption>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col" :aria-sort="sortKey === column.key ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'">
              <button type="button" class="table-sort-button" :aria-label="`Sort by ${column.label}${sortKey === column.key ? ', currently ' + (sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`" @click="sort(column.key)">
                {{ column.label }} <span aria-hidden="true">{{ sortKey === column.key ? sortDirection === 'asc' ? '↑' : '↓' : '↕' }}</span>
              </button>
            </th>
          </tr>
          <tr>
            <td v-for="column in columns" :key="column.key">
              <label :for="`${id}-filter-${column.key}`" class="visually-hidden">Search {{ column.label }}</label>
              <input :id="`${id}-filter-${column.key}`" v-model="filters[column.key]" type="search" maxlength="100" class="form-control form-control-sm" :placeholder="`Filter ${column.label.toLowerCase()}`">
            </td>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pagination.rows" :key="row.id">
            <td v-for="column in columns" :key="column.key">{{ cellText(row, column) }}</td>
          </tr>
          <tr v-if="!pagination.rows.length"><td :colspan="columns.length" class="table-empty">{{ rows.length ? 'No records match these filters. Try a different search or clear the filters.' : 'No saved records yet.' }}</td></tr>
        </tbody>
      </table>
    </div>
    <nav class="table-pagination" :aria-label="`${title} pages`">
      <span>10 rows per page</span>
      <div class="d-flex align-items-center gap-3">
        <button class="btn btn-outline-success" type="button" :disabled="pagination.page <= 1" @click="requestedPage = pagination.page - 1">Previous page</button>
        <span aria-live="polite">Page {{ pagination.page }} of {{ pagination.pageCount }}</span>
        <button class="btn btn-outline-success" type="button" :disabled="pagination.page >= pagination.pageCount" @click="requestedPage = pagination.page + 1">Next page</button>
      </div>
    </nav>
  </section>
</template>
