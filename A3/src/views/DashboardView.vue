<script setup>
// Operational totals use the full snapshot. Chart filters apply only to the analysis section.
import { computed, onScopeDispose, ref, watch } from 'vue'
import { currentUser } from '../auth'
import { loadAdminDashboard } from '../data'
import { analyseBookings, dashboardOverview, shiftDay } from '../dashboardData'
import { errorMessage } from '../errors'
import { eventTime, melbourneDay } from '../eventDates'
import DashboardChart from '../components/DashboardChart.vue'

const snapshot = ref(null)
const loading = ref(false)
const error = ref('')
const today = melbourneDay()
const from = ref(shiftDay(today, -29))
const to = ref(today)
const category = ref('')
const groupBy = ref('event')
const metric = ref('participants')
const visible = ref(['confirmed', 'cancelled', 'interest'])
const now = ref(Date.now())
const timer = setInterval(() => {
  now.value = Date.now()
}, 60000)
let version = 0
let active = true
const refresh = async () => {
  if (loading.value || currentUser.value?.role !== 'admin') return
  const requestVersion = ++version
  const uid = currentUser.value.id
  loading.value = true
  error.value = ''
  try {
    const result = await loadAdminDashboard()
    if (
      active &&
      requestVersion === version &&
      currentUser.value?.id === uid &&
      currentUser.value?.role === 'admin'
    )
      snapshot.value = result.data
  } catch (failure) {
    if (active && requestVersion === version) error.value = errorMessage(failure)
  } finally {
    if (active && requestVersion === version) loading.value = false
  }
}
// Clear private state after logout or account switch, even if a previous request is still running.
watch(
  () => [currentUser.value?.id, currentUser.value?.role],
  () => {
    version++
    snapshot.value = null
    loading.value = false
    error.value = ''
    if (currentUser.value?.role === 'admin') refresh()
  },
  { immediate: true },
)
const overview = computed(() =>
  snapshot.value ? dashboardOverview(snapshot.value, now.value) : null,
)
const categories = computed(() =>
  [...new Set(snapshot.value?.events.map((event) => event.category).filter(Boolean) || [])].sort(),
)
const analysis = computed(() => {
  if (!snapshot.value) return null
  try {
    return {
      ...analyseBookings(snapshot.value, {
        from: from.value,
        to: to.value,
        category: category.value,
        groupBy: groupBy.value,
        metric: metric.value,
      }),
      error: '',
    }
  } catch (failure) {
    return { error: failure.message }
  }
})
const series = [
  { key: 'confirmed', label: 'Currently confirmed', color: '#225c3d', dash: [] },
  { key: 'cancelled', label: 'Currently cancelled', color: '#a23b32', dash: [7, 4] },
  { key: 'interest', label: 'Interest only', color: '#185a9d', dash: [2, 4] },
]
const timeDatasets = computed(() =>
  analysis.value?.dates
    ? series
        .filter((item) => visible.value.includes(item.key))
        .map((item) => ({
          label: item.label,
          data: analysis.value.dates.map((day) => day[item.key]),
          borderColor: item.color,
          backgroundColor: item.color,
          borderDash: item.dash,
          pointRadius: 3,
          tension: 0,
        }))
    : [],
)
const rankingDatasets = computed(() => [
  {
    label: metric.value === 'participants' ? 'Confirmed participants' : 'Confirmed bookings',
    data: analysis.value?.ranking?.slice(0, 12).map((group) => group.value) || [],
    backgroundColor: '#286742',
  },
])
const generated = computed(() =>
  snapshot.value
    ? new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(snapshot.value.generatedAt))
    : '',
)
const toggleSeries = (key) => {
  visible.value = visible.value.includes(key)
    ? visible.value.filter((value) => value !== key)
    : [...visible.value, key]
}
const reset = () => {
  from.value = shiftDay(melbourneDay(), -29)
  to.value = melbourneDay()
  category.value = ''
  groupBy.value = 'event'
  metric.value = 'participants'
  visible.value = series.map((item) => item.key)
}
onScopeDispose(() => {
  active = false
  version++
  clearInterval(timer)
})
</script>

<template>
  <main id="main-content" class="route-page" tabindex="-1">
    <section class="container" aria-labelledby="dashboardHeading">
      <div class="section-heading">
        <div>
          <p class="section-label mb-2">Admin area</p>
          <h1 id="dashboardHeading" class="section-title">Community dashboard</h1>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <RouterLink class="btn btn-outline-success" :to="{ name: 'records' }"
            >Registration records</RouterLink
          ><button class="btn btn-success" type="button" :disabled="loading" @click="refresh">
            {{ loading ? 'Refreshing…' : 'Refresh dashboard' }}
          </button>
        </div>
      </div>
      <p class="section-introduction">
        Review account roles, activity capacity and booking patterns. Only administrators can load
        this data.
      </p>
      <p v-if="loading" role="status">Loading the latest account and booking snapshot…</p>
      <p v-if="error" class="alert alert-danger" role="alert">
        {{ error }} <span v-if="snapshot">The figures below are from the earlier snapshot.</span>
      </p>
      <template v-if="snapshot && overview">
        <p class="text-secondary">
          Snapshot: {{ generated }} (Melbourne time). Use Refresh dashboard after booking or
          cancelling an activity. Date filters below apply to the analysis, not these overall
          totals.
        </p>
        <dl class="dashboard-metrics">
          <div class="content-panel">
            <dt>GreenConnect accounts</dt>
            <dd>{{ snapshot.accounts.total }}</dd>
            <dd class="dashboard-detail">
              {{ snapshot.accounts.admins }} admin(s) · {{ snapshot.accounts.members }} member(s)
            </dd>
          </div>
          <div class="content-panel">
            <dt>Activities</dt>
            <dd>{{ overview.events }}</dd>
            <dd class="dashboard-detail">{{ overview.upcoming }} upcoming</dd>
          </div>
          <div class="content-panel">
            <dt>Confirmed bookings</dt>
            <dd>{{ overview.confirmed }}</dd>
            <dd class="dashboard-detail">{{ overview.participants }} reserved participant places</dd>
          </div>
          <div class="content-panel">
            <dt>Places still available</dt>
            <dd>{{ overview.remaining }}</dd>
            <dd class="dashboard-detail">Across upcoming activities</dd>
          </div>
        </dl>
        <div class="content-panel mb-4">
          <h2 class="h4">Account and booking overview</h2>
          <p>
            Account counts cover Firebase Auth accounts linked to a GreenConnect profile. Roles come
            from current Auth claims, not editable profile fields. Disabled accounts are included in
            their role totals.
          </p>
          <dl class="dashboard-summary">
            <div>
              <dt>Disabled accounts</dt>
              <dd>{{ snapshot.accounts.disabled }}</dd>
            </div>
            <div>
              <dt>All booking records</dt>
              <dd>{{ overview.records }}</dd>
            </div>
            <div>
              <dt>Cancelled records</dt>
              <dd>{{ overview.cancelled }}</dd>
            </div>
            <div>
              <dt>Interest-only records</dt>
              <dd>{{ overview.interests }}</dd>
            </div>
          </dl>
          <p v-if="snapshot.accounts.missingAuthAccounts" class="alert alert-warning">
            {{ snapshot.accounts.missingAuthAccounts }} profile(s) have no matching Auth account and
            are excluded from account totals.
          </p>
          <p v-if="overview.capacityMismatch" class="alert alert-warning" role="status">
            The event capacity counters and confirmed participant totals disagree. Check the saved
            records before changing event capacity.
          </p>
        </div>
        <h2 class="h4">Upcoming activity capacity</h2>
        <p v-if="!overview.upcomingEvents.length">There are no upcoming activities.</p>
        <div
          v-else
          class="table-scroll-region mb-4"
          tabindex="0"
          role="region"
          aria-label="Upcoming activity capacity table"
        >
          <table class="records-data-table">
            <caption class="visually-hidden">
              Upcoming activities, reserved places and remaining capacity
            </caption>
            <thead>
              <tr>
                <th scope="col">Activity</th>
                <th scope="col">Date and time</th>
                <th scope="col">Reserved / capacity</th>
                <th scope="col">Available</th>
                <th scope="col">Occupancy</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in overview.upcomingEvents" :key="event.id">
                <th scope="row">{{ event.title }}</th>
                <td>{{ eventTime(event.startAt, event.endAt) }}</td>
                <td>{{ event.bookedPlaces || 0 }} / {{ event.capacity }}</td>
                <td>{{ event.available }}</td>
                <td>{{ event.occupancy }}%</td>
                <td>
                  <RouterLink :to="{ name: 'calendar', query: { event: event.id } }"
                    >View activity</RouterLink
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <section class="content-panel mb-4" aria-labelledby="analysisHeading">
          <h2 id="analysisHeading" class="h3">Booking analysis</h2>
          <p>
            Filter by the date each record was first created, in Melbourne time. Each record is
            shown with its current status. Rebooking updates the existing record, so these charts
            are not a full history of every booking action. Fictional table examples are excluded.
          </p>
          <div class="dashboard-filters">
            <div>
              <label for="analysisFrom" class="form-label">Record creation date: from</label
              ><input id="analysisFrom" v-model="from" type="date" class="form-control" />
            </div>
            <div>
              <label for="analysisTo" class="form-label">Record creation date: to</label
              ><input id="analysisTo" v-model="to" type="date" class="form-control" />
            </div>
            <div>
              <label for="analysisCategory" class="form-label">Analysis category</label
              ><select id="analysisCategory" v-model="category" class="form-select">
                <option value="">All categories</option>
                <option v-for="item in categories" :key="item">{{ item }}</option>
              </select>
            </div>
            <button type="button" class="btn btn-outline-success" @click="reset">
              Reset analysis filters
            </button>
          </div>
          <p v-if="analysis?.error" class="alert alert-warning mt-3" role="alert">
            {{ analysis.error }}
          </p>
          <template v-else-if="analysis">
            <p class="mt-3" role="status">
              {{ analysis.matching }} matching records · {{ analysis.confirmed }} currently
              confirmed bookings · {{ analysis.participants }} confirmed participant places.
            </p>
            <p v-if="analysis.excludedDates" class="text-secondary">
              {{ analysis.excludedDates }} record(s) have no usable creation date and are excluded
              from this analysis.
            </p>
            <p v-if="!analysis.matching" class="alert alert-info">
              No saved booking records match these filters. Zero values are shown; no demonstration
              bookings are added to these charts.
            </p>
            <h3 class="h4">Booking records over time</h3>
            <p id="timeChartHelp">
              Each point counts records created on that date, grouped by current status. Use the
              buttons to show or hide lines; the table retains every status.
            </p>
            <div class="d-flex flex-wrap gap-2 mb-3" aria-label="Visible booking status lines">
              <button
                v-for="item in series"
                :key="item.key"
                class="btn btn-outline-success"
                type="button"
                :aria-pressed="visible.includes(item.key)"
                @click="toggleSeries(item.key)"
              >
                {{ visible.includes(item.key) ? 'Hide' : 'Show' }} {{ item.label.toLowerCase() }}
              </button>
            </div>
            <DashboardChart
              :labels="analysis.dates.map((day) => day.day)"
              :datasets="timeDatasets"
              label="Booking records by creation date and current status"
              describedby="timeChartHelp"
            />
            <details class="mt-3">
              <summary>View date chart data as a table</summary>
              <div
                class="table-scroll-region mt-2"
                tabindex="0"
                role="region"
                aria-label="Booking dates data"
              >
                <table id="timeData" class="records-data-table">
                  <caption>
                    All statuses by record creation date
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Melbourne date</th>
                      <th scope="col">Confirmed</th>
                      <th scope="col">Cancelled</th>
                      <th scope="col">Interest only</th>
                      <th scope="col">Other status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="day in analysis.dates" :key="day.day">
                      <th scope="row">{{ day.day }}</th>
                      <td>{{ day.confirmed }}</td>
                      <td>{{ day.cancelled }}</td>
                      <td>{{ day.interest }}</td>
                      <td>{{ day.other }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
            <hr class="my-4" />
            <h3 class="h4">Confirmed participation</h3>
            <div class="dashboard-filters mb-3">
              <div>
                <label for="analysisGroup" class="form-label">Group participation by</label
                ><select id="analysisGroup" v-model="groupBy" class="form-select">
                  <option value="event">Activity</option>
                  <option value="category">Category</option>
                </select>
              </div>
              <div>
                <label for="analysisMetric" class="form-label">Participation measure</label
                ><select id="analysisMetric" v-model="metric" class="form-select">
                  <option value="participants">Participant places</option>
                  <option value="bookings">Bookings</option>
                </select>
              </div>
            </div>
            <p id="rankingChartHelp">
              A booking can reserve several participant places. Cancelled and interest-only records
              do not contribute to this chart. Up to 12 groups are drawn; the table includes every
              group.
            </p>
            <DashboardChart
              v-if="analysis.ranking.length"
              type="bar"
              horizontal
              :labels="analysis.ranking.slice(0, 12).map((group) => group.label)"
              :datasets="rankingDatasets"
              label="Confirmed participation by activity or category"
              describedby="rankingChartHelp"
            />
            <div
              class="table-scroll-region mt-3"
              tabindex="0"
              role="region"
              aria-label="Confirmed participation data"
            >
              <table id="rankingData" class="records-data-table">
                <caption>
                  Confirmed participation for the selected creation dates and category
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{{ groupBy === 'event' ? 'Activity' : 'Category' }}</th>
                    <th scope="col">Confirmed bookings</th>
                    <th scope="col">Participant places</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="group in analysis.ranking" :key="group.key">
                    <th scope="row">{{ group.label }}</th>
                    <td>{{ group.bookings }}</td>
                    <td>{{ group.participants }}</td>
                  </tr>
                  <tr v-if="!analysis.ranking.length">
                    <td colspan="3">No matching activity groups.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </section>
      </template>
    </section>
  </main>
</template>
