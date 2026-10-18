// Shared Firestore listeners and callable function wrappers used by the Vue components.
import { onScopeDispose, ref, watch } from 'vue'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'
import { currentUser } from './auth'
import { errorMessage } from './errors'

export const dataPath = (...parts) => ['greenconnect', 'v1', ...parts]

// Each component receives reactive rows, loading state and a readable subscription error.
export const useCollection = (name, { owned = false, admin = false, sort = null } = {}) => {
  const rows = ref([])
  const loading = ref(true)
  const error = ref('')
  let unsubscribe = () => {}
  // Replace the listener when the account or role changes. Clear old rows before checking the new access.
  const stop = watch(() => [currentUser.value?.id, currentUser.value?.role], () => {
    unsubscribe()
    rows.value = []
    error.value = ''
    loading.value = false
    if (!db || (owned && !currentUser.value) || (admin && currentUser.value?.role !== 'admin')) return
    loading.value = true
    const filters = []
    // An owner query matches the Firestore rule. Client filtering after downloading all records would expose them.
    if (owned) filters.push(where('userId', '==', currentUser.value.id))
    if (sort) filters.push(orderBy(sort))
    // onSnapshot sends the initial data and later changes, such as a booking using the last place.
    unsubscribe = onSnapshot(query(collection(db, ...dataPath(name)), ...filters), (snapshot) => {
      rows.value = snapshot.docs.map((row) => {
        const data = row.data()
        if (name === 'events') data.availablePlaces = Math.max(0, data.capacity - (data.bookedPlaces || 0))
        return { ...data, id: row.id }
      })
      loading.value = false
    }, (failure) => {
      rows.value = []
      loading.value = false
      error.value = errorMessage(failure)
    })
  }, { immediate: true })
  // Remove the listener when the component leaves the page so it cannot keep updating old state.
  onScopeDispose(() => { unsubscribe(); stop() })
  return { rows, loading, error }
}

// Listen to one private rating document per event for the current account only.
export const useOwnRatings = (events) => {
  const ratings = ref({})
  const error = ref('')
  let subscriptions = []
  const stop = watch(() => [currentUser.value?.id, events.value.map((event) => event.id).join(',')], () => {
    subscriptions.forEach((unsubscribe) => unsubscribe())
    subscriptions = []
    ratings.value = {}
    error.value = ''
    if (!db || !currentUser.value) return
    subscriptions = events.value.map((event) => onSnapshot(
      doc(db, ...dataPath('events', event.id, 'ratings', currentUser.value.id)),
      (snapshot) => { ratings.value = { ...ratings.value, [event.id]: snapshot.data()?.score || 0 } },
      (failure) => { error.value = errorMessage(failure) },
    ))
  }, { immediate: true })
  onScopeDispose(() => { subscriptions.forEach((unsubscribe) => unsubscribe()); stop() })
  return { ratings, error }
}

// Callable wrappers keep backend names out of individual UI components. Firebase adds the current auth token.
export const saveRating = (eventId, score) => httpsCallable(functions, 'greenconnectRateEvent')({ eventId, score })
export const bookEvent = (details) => httpsCallable(functions, 'greenconnectBookEvent')(details)
export const cancelBooking = (eventId) => httpsCallable(functions, 'greenconnectCancelBooking')({ eventId })
export const sendBookingEmail = (eventId) => httpsCallable(functions, 'greenconnectSendBookingEmail')({ eventId })
// Only an authenticated admin receives this snapshot; no account identities are returned for the charts.
export const loadAdminDashboard = () => httpsCallable(functions, 'greenconnectAdminDashboard')({})
