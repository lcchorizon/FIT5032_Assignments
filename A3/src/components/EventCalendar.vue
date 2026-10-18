<script setup>
// Show the activity dates and emit the selected event to the parent booking page.
import { computed, ref, watch } from 'vue'
import { melbourneDay, monthDays, eventTime } from '../eventDates'

const props = defineProps({ events: { type: Array, required: true }, selectedEventId: { type: String, default: null } })
const emit = defineEmits(['select-event'])
const today = melbourneDay()
const selectedDay = ref(today)
const [initialYear, initialMonth] = today.split('-').map(Number)
const year = ref(initialYear)
const month = ref(initialMonth - 1)
let initialised = false
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const days = computed(() => monthDays(year.value, month.value))
const monthLabel = computed(() => new Intl.DateTimeFormat('en-AU', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(Date.UTC(year.value, month.value, 1))))
// Group by Melbourne day once, then reuse the groups for date counts and the selected-day list.
const eventsByDay = computed(() => {
  const result = {}
  props.events.forEach((event) => {
    const day = melbourneDay(event.startAt)
    if (!result[day]) result[day] = []
    result[day].push(event)
  })
  return result
})
const selectedEvents = computed(() => eventsByDay.value[selectedDay.value] || [])
const selectedLabel = computed(() => new Intl.DateTimeFormat('en-AU', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${selectedDay.value}T12:00:00Z`)))

// Date arithmetic handles moving between December and January without a separate year check.
const chooseMonth = (step) => {
  const date = new Date(Date.UTC(year.value, month.value + step, 1))
  year.value = date.getUTCFullYear()
  month.value = date.getUTCMonth()
  const prefix = date.toISOString().slice(0, 7)
  selectedDay.value = Object.keys(eventsByDay.value).sort().find((day) => day.startsWith(prefix)) || `${prefix}-01`
}
const goToday = () => {
  const [y, m] = today.split('-').map(Number)
  year.value = y
  month.value = m - 1
  selectedDay.value = today
}
const chooseEvent = (event) => {
  emit('select-event', event)
}
// On first load, open the requested activity or the next future event. Later live updates should not move the calendar.
watch(() => props.events, (events) => {
  if (initialised || !events.length) return
  initialised = true
  const next = events.find((event) => event.id === props.selectedEventId) || [...events].filter((event) => Date.parse(event.startAt) > Date.now())
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0]
  if (next) {
    selectedDay.value = melbourneDay(next.startAt)
    const [y, m] = selectedDay.value.split('-').map(Number)
    year.value = y
    month.value = m - 1
  }
}, { immediate: true })
watch(() => props.selectedEventId, (id) => {
  const event = props.events.find((event) => event.id === id)
  if (!event) return
  selectedDay.value = melbourneDay(event.startAt)
  const [y, m] = selectedDay.value.split('-').map(Number)
  year.value = y
  month.value = m - 1
})
</script>

<template>
  <div class="booking-calendar-layout">
    <section class="content-panel calendar-panel" aria-label="Activity calendar">
      <div class="calendar-toolbar">
        <h2 class="h4 mb-0" aria-live="polite">{{ monthLabel }}</h2>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-success" type="button" aria-label="Previous month" @click="chooseMonth(-1)">‹</button>
          <button class="btn btn-outline-success" type="button" @click="goToday">Today</button>
          <button class="btn btn-outline-success" type="button" aria-label="Next month" @click="chooseMonth(1)">›</button>
        </div>
      </div>
      <p id="calendarHelp" class="text-secondary">Choose a day to see its activities. All times are in Melbourne.</p>
      <div class="calendar-weekdays" aria-hidden="true"><span v-for="day in weekdays" :key="day">{{ day }}</span></div>
      <ol class="calendar-days" aria-describedby="calendarHelp">
        <li v-for="day in days" :key="day.key">
          <button
            type="button"
            :class="{ 'calendar-outside': !day.inMonth, 'calendar-selected': selectedDay === day.key, 'calendar-today': day.key === today }"
            :aria-label="`${day.key}, ${(eventsByDay[day.key] || []).length} activities`"
            :aria-pressed="selectedDay === day.key"
            :aria-current="day.key === today ? 'date' : undefined"
            @click="selectedDay = day.key"
          >
            <span>{{ day.day }}</span>
            <small v-if="eventsByDay[day.key]?.length" class="calendar-event-count">{{ eventsByDay[day.key].length }}<span class="visually-hidden"> activities</span></small>
          </button>
        </li>
      </ol>
    </section>
    <section class="calendar-day-events" aria-live="polite" aria-label="Activities on the selected day">
      <h2 class="h4">{{ selectedLabel }}</h2>
      <p v-if="!selectedEvents.length" class="content-panel">There are no activities on this day. Try another highlighted date.</p>
      <article v-for="event in selectedEvents" :key="event.id" class="content-panel mb-3">
        <span class="category-badge mb-3">{{ event.category }}</span>
        <h3 class="h5">{{ event.title }}</h3>
        <p>{{ eventTime(event.startAt, event.endAt) }}</p>
        <p>{{ event.location }}</p>
        <p><strong>{{ event.availablePlaces }}</strong> places available</p>
        <button
          class="btn btn-success" type="button"
          :aria-label="`Choose ${event.title}`"
          :aria-pressed="selectedEventId === event.id"
          @click="chooseEvent(event)"
        >{{ selectedEventId === event.id ? 'Selected' : 'Choose event' }}</button>
      </article>
    </section>
  </div>
</template>
