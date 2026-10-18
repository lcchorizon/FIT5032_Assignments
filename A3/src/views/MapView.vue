<script setup>
// Manage starting places, nearby filters and road route requests for the event map.
import { computed, onScopeDispose, ref, watch } from 'vue'
import EventMap from '../components/EventMap.vue'
import { useCollection } from '../data'
import { eventTime } from '../eventDates'
import { getEventRoute, searchPlaces } from '../mapApi'
import { nearbyEvents, routeSummary, validMapPoint } from '../mapData'

const { rows: events, loading, error } = useCollection('events', { sort: 'startAt' })
const placeQuery = ref('')
const places = ref([])
const origin = ref(null)
const searching = ref(false)
const locating = ref(false)
const routing = ref(false)
const placeError = ref('')
const routeError = ref('')
const selectedId = ref('')
const route = ref(null)
const radius = ref(25)
const query = ref('')
const category = ref('')
const categories = computed(() => [...new Set(events.value.map((event) => event.category))].sort())
// Nearby filtering is local; it does not make a provider request on each keystroke.
const matching = computed(() => nearbyEvents(events.value, origin.value, radius.value, query.value, category.value))
const missingLocations = computed(() => events.value.filter((event) => !validMapPoint(event)).length)
const selected = computed(() => matching.value.find((event) => event.id === selectedId.value))
let searchController
let routeController
// The browser location callback cannot be cancelled. A version check lets us ignore an outdated callback.
let locationVersion = 0
let active = true
// An old route must disappear when the origin or selected event changes.
const clearRoute = () => { routeController?.abort(); route.value = null; routeError.value = ''; routing.value = false }
const setOrigin = (place) => { locationVersion++; locating.value = false; origin.value = place; places.value = []; placeError.value = ''; clearRoute() }
watch(() => [selected.value?.id, selected.value?.latitude, selected.value?.longitude], clearRoute)
// Abort the previous search so a slower old response cannot replace the new results.
const search = async () => {
  searchController?.abort()
  const controller = new AbortController()
  searchController = controller
  locationVersion++; locating.value = false
  places.value = []; placeError.value = ''; searching.value = true
  try {
    const data = await searchPlaces(placeQuery.value.trim(), controller.signal)
    if (active && !controller.signal.aborted) {
      places.value = data.places
      if (!data.places.length) placeError.value = 'No matching places in greater Melbourne. Try a suburb or public landmark.'
    }
  } catch (failure) { if (!controller.signal.aborted && active) placeError.value = failure.message }
  finally { if (searchController === controller) searching.value = false }
}
// Request location only after the user chooses this action. Manual search remains available after denial.
const locate = () => {
  searchController?.abort(); searching.value = false; places.value = []; placeError.value = ''
  const version = ++locationVersion
  if (!navigator.geolocation) { placeError.value = 'Location is unavailable in this browser. Search for a public place instead.'; return }
  locating.value = true
  navigator.geolocation.getCurrentPosition((position) => {
    if (!active || version !== locationVersion) return
    locating.value = false
    const point = { latitude: position.coords.latitude, longitude: position.coords.longitude, label: 'Your current location' }
    if (!validMapPoint(point)) { placeError.value = 'Your location is outside greater Melbourne. Search for a Melbourne suburb or public place instead.'; return }
    setOrigin(point)
  }, (failure) => {
    if (!active || version !== locationVersion) return
    locating.value = false
    placeError.value = failure.code === 1 ? 'Location permission was declined. Search for a suburb or public place instead.' : 'Your location could not be found. Search for a public place instead.'
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
}
// Only a deliberate button action calls the route provider. Selection changes cancel the pending result.
const planRoute = async () => {
  if (!origin.value || !selected.value || routing.value) return
  clearRoute()
  const controller = new AbortController()
  routeController = controller
  routing.value = true
  try {
    const data = await getEventRoute(origin.value, selected.value.id, controller.signal)
    if (active && !controller.signal.aborted) route.value = data
  } catch (failure) { if (!controller.signal.aborted && active) routeError.value = failure.message }
  finally { if (routeController === controller) routing.value = false }
}
const clearOrigin = () => { searchController?.abort(); searching.value = false; setOrigin(null) }
// Stop network work and ignore location callbacks after leaving the page.
onScopeDispose(() => { active = false; locationVersion++; searchController?.abort(); routeController?.abort() })
</script>

<template>
  <main id="main-content" class="route-page" tabindex="-1">
    <section class="container" aria-labelledby="mapHeading">
      <div class="section-heading">
        <div><p class="section-label mb-2">Explore Melbourne</p><h1 id="mapHeading" class="section-title">Find activities and plan a route</h1></div>
        <RouterLink class="btn btn-outline-success" :to="{ name: 'events' }">Event directory</RouterLink>
      </div>
      <p class="section-introduction">Search for a suburb or public place, find nearby activities and plan a driving route. These are demonstration activities with approximate locations.</p>
      <div class="content-panel mb-4">
        <h2 class="h4">1. Choose your starting point</h2>
        <p id="placePrivacy" class="text-secondary">Place searches are shared with Photon by komoot. Route requests share your start and event coordinates with OSRM / FOSSGIS through this app. Use a public landmark if you prefer. Your current location is only requested when you choose that button.</p>
        <form class="place-search" @submit.prevent="search">
          <div class="flex-grow-1"><label for="placeQuery" class="form-label">Suburb or public place in greater Melbourne</label><input id="placeQuery" v-model="placeQuery" class="form-control" type="search" minlength="3" maxlength="120" required aria-describedby="placePrivacy" placeholder="For example, Flinders Street Station"></div>
          <button class="btn btn-success" type="submit" :disabled="searching">{{ searching ? 'Searching…' : 'Search places' }}</button>
          <button class="btn btn-outline-success" type="button" :disabled="locating" @click="locate">{{ locating ? 'Finding location…' : 'Use my current location' }}</button>
        </form>
        <p v-if="placeError" class="alert alert-warning mt-3 mb-0" role="alert">{{ placeError }}</p>
        <ul v-if="places.length" class="place-results mt-3" aria-label="Matching starting places"><li v-for="(place, index) in places" :key="index"><button type="button" class="btn btn-outline-success text-start" @click="setOrigin(place)">{{ place.label }}</button></li></ul>
        <p v-if="searching || locating" class="mt-3" role="status">{{ searching ? 'Looking for matching places…' : 'Waiting for your browser location…' }}</p>
        <div v-if="origin" class="mt-3" role="status"><strong>Starting point:</strong> {{ origin.label }} <button class="btn btn-link" type="button" @click="clearOrigin">Clear starting point</button></div>
      </div>
      <p v-if="loading" role="status">Loading event locations…</p>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <div class="map-filter-grid mb-4">
        <div><label for="mapQuery" class="form-label">Search activities</label><input id="mapQuery" v-model="query" type="search" class="form-control" maxlength="120"></div>
        <div><label for="mapCategory" class="form-label">Activity category</label><select id="mapCategory" v-model="category" class="form-select"><option value="">All categories</option><option v-for="item in categories" :key="item">{{ item }}</option></select></div>
        <div><label for="mapRadius" class="form-label">Distance from starting point</label><select id="mapRadius" v-model.number="radius" class="form-select" :disabled="!origin"><option :value="5">Within 5 km</option><option :value="15">Within 15 km</option><option :value="25">Within 25 km</option><option :value="100">Within 100 km</option></select></div>
      </div>
      <p role="status">{{ matching.length }} matching activities{{ origin ? ', nearest first. Distances below are straight-line distances.' : '. Choose a starting point to sort by distance.' }}</p>
      <p v-if="missingLocations" class="text-secondary">{{ missingLocations }} activities have no usable location and are listed in the event directory.</p>
      <EventMap :events="matching" :origin="origin" :selected-id="selectedId" :route="route" @select="selectedId = $event" />
      <div class="content-panel my-4" aria-labelledby="routeHeading">
        <h2 id="routeHeading" class="h4">2. Choose an activity and plan your route</h2>
        <p v-if="!selected">Select an activity from the list below or from a map marker.</p>
        <template v-else>
          <h3 class="h5">{{ selected.title }}</h3>
          <p>{{ selected.location }} · {{ eventTime(selected.startAt, selected.endAt) }}</p>
          <div class="d-flex flex-wrap gap-2"><button class="btn btn-success" type="button" :disabled="!origin || routing" @click="planRoute">{{ routing ? 'Planning route…' : 'Plan driving route' }}</button><RouterLink class="btn btn-outline-success" :to="{ name: 'calendar', query: { event: selected.id } }">Open booking</RouterLink></div>
          <p v-if="!origin" class="mt-2">Choose a starting point above before planning a route.</p>
        </template>
        <p v-if="routing" role="status" class="mt-3">Calculating a road route…</p>
        <p v-if="routeError" class="alert alert-warning mt-3" role="alert">{{ routeError }}</p>
        <div v-if="route" class="alert alert-success mt-3 mb-0" role="status"><strong>{{ routeSummary(route) }}</strong><p class="mb-0 mt-2">From {{ origin.label }} to {{ selected.title }}. Estimated driving time does not include live traffic, parking or walking to the activity.</p><p v-if="route.startSnapMetres > 300 || route.endSnapMetres > 300" class="mb-0 mt-2">The route starts or ends more than 300 metres from the selected point because it uses the nearest routable road. Check local access before travelling.</p></div>
      </div>
      <h2 class="h4">Matching activities</h2>
      <p v-if="!loading && !matching.length">No activities match these filters. Try a larger distance or another category.</p>
      <ul class="map-event-list"><li v-for="event in matching" :key="event.id" class="content-panel"><div><h3 class="h5">{{ event.title }}</h3><p class="mb-1">{{ event.location }} · {{ event.category }}</p><p class="mb-1">{{ eventTime(event.startAt, event.endAt) }}</p><p class="mb-0">{{ event.availablePlaces }} places available<span v-if="origin"> · {{ event.distanceKm.toFixed(1) }} km away in a straight line</span></p></div><button class="btn btn-outline-success" type="button" :aria-pressed="selectedId === event.id" @click="selectedId = event.id">{{ selectedId === event.id ? 'Selected: ' : 'Select: ' }}{{ event.title }}</button></li></ul>
      <p class="text-secondary mt-4">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>. Place search: Photon by komoot. Driving routes: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">OSRM / FOSSGIS</a>. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Fix the map</a>. These public services may be unavailable or limit requests.</p>
    </section>
  </main>
</template>
