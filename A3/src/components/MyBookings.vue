<script setup>
// Show only the current member's records and send booking actions to the backend.
import { computed, onScopeDispose, ref, watch } from 'vue'
import { currentUser } from '../auth'
import { cancelBooking, sendBookingEmail, useCollection } from '../data'
import { errorMessage } from '../errors'
import { eventTime } from '../eventDates'
import { bookingEmailEnabled, bookingEmailTestMode } from '../features'

const { rows, loading, error } = useCollection('registrations', { owned: true })
// Sort a copy of the listener rows so the shared data is not changed.
const registrations = computed(() => [...rows.value].sort((a, b) => (a.startAt || '').localeCompare(b.startAt || '')))
const confirmId = ref(null)
const cancelling = ref(null)
const status = ref('')
const actionError = ref('')
const emailing = ref(null)
// Keep the account ID for this request. Do not show its result after the user has switched accounts.
const emailBooking = async (booking) => {
  if (emailing.value) return
  const uid = currentUser.value?.id
  emailing.value = booking.id
  actionError.value = ''; status.value = ''
  try {
    const { data } = await sendBookingEmail(booking.eventId)
    if (currentUser.value?.id === uid) status.value = data.alreadySubmitted
      ? 'This confirmation was already accepted by the email service. Check your inbox and spam folder.'
      : 'The email service accepted your confirmation with its PDF attachment. Check your inbox and spam folder. Delivery may take a few minutes.'
  } catch (failure) {
    if (currentUser.value?.id === uid) actionError.value = errorMessage(failure)
  } finally { emailing.value = null }
}
const now = ref(Date.now())
const clock = setInterval(() => { now.value = Date.now() }, 30000)
onScopeDispose(() => clearInterval(clock))
// The confirmation button only starts a server request. Capacity changes when the backend transaction succeeds.
const cancel = async (booking) => {
  if (cancelling.value) return
  const userId = currentUser.value?.id
  cancelling.value = booking.id
  status.value = ''
  actionError.value = ''
  try {
    await cancelBooking(booking.eventId)
    if (currentUser.value?.id !== userId) return
    status.value = `Your booking for ${booking.eventTitle} was cancelled. The places are available again.`
    confirmId.value = null
  } catch (error) {
    if (currentUser.value?.id === userId) actionError.value = errorMessage(error)
  } finally {
    cancelling.value = null
  }
}
watch(() => currentUser.value?.id, () => { confirmId.value = null; status.value = ''; actionError.value = '' })
const statusLabel = (status) => ({ confirmed: 'Confirmed', cancelled: 'Cancelled', interest: 'Interest only — no place reserved' })[status] || status
</script>

<template>
  <section id="my-bookings" class="page-section" aria-labelledby="myBookingsHeading">
    <div class="container">
      <div class="section-heading">
        <div><p class="section-label mb-2">Your activities</p><h2 id="myBookingsHeading" class="section-title">My bookings</h2></div>
        <RouterLink class="btn btn-outline-success" :to="{ name: 'calendar' }">Find another activity</RouterLink>
      </div>
      <p v-if="!currentUser">Log in to see your bookings.</p>
      <template v-else>
        <p v-if="bookingEmailEnabled">Booking emails go to {{ currentUser.email }}. One confirmation is submitted for each booking. Verify your email in Your account before using this option.</p>
        <p v-if="bookingEmailEnabled && bookingEmailTestMode" class="alert alert-info">Email is using the service provider's test sender. Only the service owner's verified account can receive confirmations until a sending domain is configured.</p>
        <p v-if="loading" role="status">Loading your bookings…</p>
        <p v-if="error || actionError" class="alert alert-danger" role="alert">{{ error || actionError }}</p>
        <p v-if="status" class="alert alert-success" role="status">{{ status }}</p>
        <p v-if="!loading && !error && !registrations.length">You do not have any bookings yet.</p>
        <ul v-if="registrations.length" class="booking-list">
          <li v-for="booking in registrations" :key="booking.id" class="content-panel">
            <div class="booking-summary">
              <div>
                <h3 class="h5">{{ booking.eventTitle }}</h3>
                <p v-if="booking.startAt" class="mb-1">{{ eventTime(booking.startAt, booking.endAt) }}</p>
                <p v-if="booking.location" class="mb-1">{{ booking.location }}</p>
                <p class="mb-1">{{ booking.participants }} participant(s)</p>
                <span class="status-badge" :class="{ 'booking-cancelled': booking.status === 'cancelled' }">{{ statusLabel(booking.status) }}</span>
              </div>
              <button
                v-if="bookingEmailEnabled && booking.status === 'confirmed'" class="btn btn-outline-success" type="button"
                :disabled="Boolean(emailing) || Boolean(cancelling) || !currentUser.emailVerified"
                :aria-label="`${emailing === booking.id ? 'Submitting email…' : 'Email confirmation (PDF)'} for ${booking.eventTitle}`" @click="emailBooking(booking)"
              >{{ emailing === booking.id ? 'Submitting email…' : 'Email confirmation (PDF)' }}</button>
              <button
                v-if="booking.status === 'confirmed' && Date.parse(booking.startAt) > now && confirmId !== booking.id"
                class="btn btn-outline-danger" type="button" :disabled="Boolean(cancelling)"
                :aria-label="`Cancel booking for ${booking.eventTitle}`" @click="confirmId = booking.id"
              >Cancel booking</button>
              <RouterLink v-if="booking.status === 'interest'" class="btn btn-outline-success" :to="{ name: 'calendar', query: { event: booking.eventId } }">Complete booking</RouterLink>
              <RouterLink v-if="booking.status === 'cancelled' && Date.parse(booking.startAt) > now" class="btn btn-outline-success" :to="{ name: 'calendar', query: { event: booking.eventId } }">Book again</RouterLink>
            </div>
            <div v-if="confirmId === booking.id" class="booking-cancel-confirm mt-3">
              <p>Cancel this booking and release {{ booking.participants }} place(s)?</p>
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-danger" type="button" :disabled="Boolean(cancelling)" @click="cancel(booking)">{{ cancelling === booking.id ? 'Cancelling…' : 'Yes, cancel booking' }}</button>
                <button class="btn btn-outline-secondary" type="button" :disabled="Boolean(cancelling)" @click="confirmId = null">Keep booking</button>
              </div>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
