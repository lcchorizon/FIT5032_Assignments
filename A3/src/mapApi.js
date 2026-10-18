// Call the app backend for place search and road routes, with a timeout and cancellation.
import { useEmulators } from './firebase'

// Local requests go to the Functions emulator; production uses the hosting /api rewrite.
const base = useEmulators ? 'http://127.0.0.1:5001/demo-greenconnect-a3/us-central1/greenconnectPublicApi' : ''
const request = async (path, options, signal) => {
  let response
  try {
    response = await fetch(`${base}${path}`, { ...options,
      // Either a page change or the timeout can abort a pending request.
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Could not reach the map service. Check your connection and try again.', { cause: error })
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error?.message || 'The map service is temporarily unavailable.')
  return data
}
export const searchPlaces = (query, signal) => request(`/api/places?${new URLSearchParams({ q: query })}`, {}, signal)
// Use a POST body for origin coordinates. The backend looks up the event destination itself.
export const getEventRoute = (origin, eventId, signal) => request('/api/route', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ latitude: origin.latitude, longitude: origin.longitude, eventId }),
}, signal)
