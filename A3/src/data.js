import { onScopeDispose, ref, watch } from 'vue'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'
import { currentUser } from './auth'
import { errorMessage } from './errors'

export const dataPath = (...parts) => ['greenconnect', 'v1', ...parts]

export const useCollection = (name, { owned = false, admin = false, sort = null } = {}) => {
  const rows = ref([])
  const loading = ref(true)
  const error = ref('')
  let unsubscribe = () => {}
  const stop = watch(() => [currentUser.value?.id, currentUser.value?.role], () => {
    unsubscribe()
    rows.value = []
    error.value = ''
    loading.value = false
    if (!db || (owned && !currentUser.value) || (admin && currentUser.value?.role !== 'admin')) return
    loading.value = true
    const filters = []
    if (owned) filters.push(where('userId', '==', currentUser.value.id))
    if (sort) filters.push(orderBy(sort))
    unsubscribe = onSnapshot(query(collection(db, ...dataPath(name)), ...filters), (snapshot) => {
      rows.value = snapshot.docs.map((row) => ({ ...row.data(), id: row.id }))
      loading.value = false
    }, (failure) => {
      rows.value = []
      loading.value = false
      error.value = errorMessage(failure)
    })
  }, { immediate: true })
  onScopeDispose(() => { unsubscribe(); stop() })
  return { rows, loading, error }
}

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

export const saveRating = (eventId, score) => httpsCallable(functions, 'greenconnectRateEvent')({ eventId, score })
export const registerInterest = (details) => httpsCallable(functions, 'greenconnectRegisterInterest')(details)
