<script setup>
import { ref } from 'vue'
import axios from 'axios'

const city = ref('Melbourne')
const weather = ref(null)
const error = ref('')
const loading = ref(false)
const weatherText = (code) => {
  if (code === 0) return 'Clear sky'
  if (code <= 3) return 'Partly cloudy or overcast'
  if (code <= 48) return 'Fog'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorm'
}

const searchByCity = async () => {
  if (loading.value) return
  weather.value = null
  error.value = ''
  if (!city.value.trim()) {
    error.value = 'Enter a city first.'
    return
  }
  loading.value = true
  try {
    const places = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: city.value.trim(), count: 1, language: 'en', format: 'json' }, timeout: 15000,
    })
    const place = places.data.results?.[0]
    if (!place) {
      error.value = 'City not found. Please check the spelling.'
      return
    }
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: place.latitude, longitude: place.longitude,
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m', timezone: 'auto' },
      timeout: 15000,
    })
    weather.value = { place, ...response.data }
  } catch {
    error.value = 'Could not load the weather. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="container">
    <h1>Get Weather</h1>
    <p>Check the current weather before visiting the library.</p>
    <form class="row g-2 my-3" @submit.prevent="searchByCity">
      <div class="col-sm-6">
        <label for="city" class="form-label">City</label>
        <input id="city" v-model="city" class="form-control" placeholder="Melbourne" :disabled="loading">
      </div>
      <div class="col-auto align-self-end">
        <button class="btn btn-primary" :disabled="loading">Get Weather</button>
      </div>
    </form>
    <p v-if="loading" role="status">Loading weather...</p>
    <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
    <article v-if="weather" class="card card-body col-md-7 mt-4" aria-live="polite">
      <h2>{{ weather.place.name }}, {{ weather.place.country }}</h2>
      <p class="display-4 my-3">{{ weather.current.temperature_2m }} °C</p>
      <p class="fs-5">{{ weatherText(weather.current.weather_code) }}</p>
      <p>Humidity: {{ weather.current.relative_humidity_2m }}%</p>
      <p>Wind: {{ weather.current.wind_speed_10m }} km/h</p>
      <p class="text-secondary mb-0">Weather time: {{ weather.current.time.replace('T', ' ') }} ({{ weather.timezone }})</p>
    </article>
    <p class="mt-4 small">Weather data from <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>.
      Location search uses GeoNames via Open-Meteo.</p>
  </section>
</template>
