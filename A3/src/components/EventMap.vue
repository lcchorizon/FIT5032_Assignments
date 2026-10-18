<script setup>
// Display event markers and a road route with Leaflet. The parent owns search and selection state.
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({ events: { type: Array, required: true }, origin: { type: Object, default: null },
  selectedId: { type: String, default: '' }, route: { type: Object, default: null } })
const emit = defineEmits(['select'])
const element = ref(null)
const tileError = ref(false)
let map
let markers
let routeLayer
let resize
const icon = (selected, label = '•') => L.divIcon({ className: 'event-map-pin', iconSize: [30, 30], iconAnchor: [15, 15],
  html: `<span class="map-pin-dot ${selected ? 'selected' : ''}">${label}</span>` })
const draw = () => {
  if (!map) return
  markers.clearLayers(); routeLayer.clearLayers()
  // Several activities can share coordinates. One marker opens a separate choice for each activity.
  const groups = new Map()
  for (const event of props.events) {
    const key = `${event.latitude.toFixed(6)},${event.longitude.toFixed(6)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(event)
  }
  const bounds = []
  for (const events of groups.values()) {
    const point = [events[0].latitude, events[0].longitude]
    bounds.push(point)
    const popup = document.createElement('div')
    for (const event of events) {
      const button = document.createElement('button')
      button.type = 'button'; button.className = 'map-popup-button'
      // Use textContent rather than HTML from event data, so a title cannot insert markup into the popup.
      button.textContent = event.title
      button.addEventListener('click', () => emit('select', event.id))
      popup.append(button)
    }
    const marker = L.marker(point, { icon: icon(events.some((event) => event.id === props.selectedId), String(events.length)),
      title: events.map((event) => event.title).join(', '), alt: `${events.length} activities at ${events[0].location}`, keyboard: true })
      .bindPopup(popup).addTo(markers)
    marker.getElement()?.setAttribute('aria-label', `${events.length} activities at ${events[0].location}. Open activity choices.`)
  }
  if (props.origin) {
    const point = [props.origin.latitude, props.origin.longitude]
    bounds.push(point)
    const marker = L.marker(point, { icon: icon(false, 'S'), title: 'Starting point', alt: 'Starting point', keyboard: false }).addTo(markers)
    marker.getElement()?.setAttribute('aria-label', 'Starting point')
  }
  // A route response already has GeoJSON geometry. Leaflet draws it and fits the view to the road line.
  if (props.route) {
    const line = L.geoJSON(props.route.geometry, { style: { color: '#1261a0', weight: 5, opacity: .9 } }).addTo(routeLayer)
    map.fitBounds(line.getBounds(), { padding: [35, 35], maxZoom: 15, animate: false })
  } else if (bounds.length) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 14, animate: false })
  else map.setView([-37.8136, 144.9631], 10)
}
onMounted(() => {
  map = L.map(element.value, { scrollWheelZoom: false }).setView([-37.8136, 144.9631], 10)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).on('tileerror', () => { tileError.value = true }).addTo(map)
  markers = L.layerGroup().addTo(map)
  routeLayer = L.layerGroup().addTo(map)
  // Tell Leaflet when the responsive container changes size, otherwise tiles can remain partly blank.
  resize = new ResizeObserver(() => map?.invalidateSize())
  resize.observe(element.value)
  draw()
})
watch(() => [props.events, props.origin, props.selectedId, props.route], draw)
onScopeDispose(() => { resize?.disconnect(); map?.remove(); map = null })
</script>

<template>
  <div>
    <p id="mapInstructions" class="text-secondary">Markers group activities at the same place. Select a marker to see its activities, or use the activity list below. S marks your starting point. Use + and − to zoom.</p>
    <div ref="element" class="event-map" role="region" aria-label="Community event locations and driving route" aria-describedby="mapInstructions" />
    <p v-if="tileError" class="alert alert-warning mt-2" role="status">Some map tiles could not load. You can still use the activity list and text route summary.</p>
  </div>
</template>
