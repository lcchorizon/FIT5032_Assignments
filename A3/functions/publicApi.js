// Public event reads and controlled map provider requests. Account collections are not exposed here.
import { createHash } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { validId } from './validation.js'

// An explicit allowlist prevents new private document fields from appearing in the public response.
const fields = ['title', 'description', 'category', 'location', 'startAt', 'endAt', 'capacity', 'bookedPlaces', 'familyFriendly', 'latitude', 'longitude', 'isDemo']
export const publicEvent = (id, event) => ({
  id, ...Object.fromEntries(fields.filter((key) => event[key] !== undefined).map((key) => [key, event[key]])),
  availablePlaces: Math.max(0, (event.capacity || 0) - (event.bookedPlaces || 0)),
})
export const inMelbourne = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude) &&
  latitude >= -38.5 && latitude <= -37.3 && longitude >= 144.3 && longitude <= 145.8
const failure = (status, message) => Object.assign(new Error(message), { status })
const text = (value) => typeof value === 'string' ? value.trim() : ''

// Reject malformed or repeated parameters instead of silently treating them as a different search.
export const eventFilters = (query) => {
  const allowed = ['q', 'category', 'familyFriendly', 'available', 'from', 'limit']
  if (Object.keys(query).some((key) => !allowed.includes(key) || typeof query[key] !== 'string')) throw failure(400, 'Unsupported or repeated event filter.')
  for (const name of ['familyFriendly', 'available']) {
    if (query[name] !== undefined && !['true', 'false'].includes(query[name])) throw failure(400, `${name} must be true or false.`)
  }
  if ((query.q?.length || 0) > 120 || (query.category?.length || 0) > 80) throw failure(400, 'The search text is too long.')
  if (query.from !== undefined && !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(query.from)) throw failure(400, 'from must be an ISO date and time with a timezone.')
  const from = query.from === undefined ? null : Date.parse(query.from)
  if (from !== null && !Number.isFinite(from)) throw failure(400, 'from must be a valid date and time.')
  const limit = query.limit === undefined ? 100 : Number(query.limit)
  if (!/^\d+$/.test(String(limit)) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw failure(400, 'limit must be an integer from 1 to 100.')
  return { q: text(query.q).toLowerCase(), category: text(query.category), familyFriendly: query.familyFriendly,
    available: query.available, from, limit }
}
export const filterEvents = (events, filters) => events.filter((event) =>
  (!filters.q || [event.title, event.description, event.location, event.category].join(' ').toLowerCase().includes(filters.q)) &&
  (!filters.category || event.category === filters.category) &&
  (filters.familyFriendly === undefined || event.familyFriendly === (filters.familyFriendly === 'true')) &&
  (filters.available === undefined || (event.availablePlaces > 0) === (filters.available === 'true')) &&
  (filters.from === null || Date.parse(event.startAt) >= filters.from))
  .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id))

// One Firestore document per provider shares the cooldown across all function instances and users.
export const providerSlot = async (db, name, now = Date.now()) => {
  const ref = db.doc(`greenconnect/v1/mapServiceLimits/${name}`)
  await db.runTransaction(async (tx) => {
    const current = await tx.get(ref)
    if ((current.data()?.nextAt || 0) > now) throw failure(429, 'The map service is busy. Wait a moment and try again.')
    tx.set(ref, { nextAt: now + 1200 })
  })
}
// Use an identifying User-Agent and a timeout when calling the public map services.
const fetchJson = async (url, fetcher) => {
  let response
  try {
    response = await fetcher(url, { headers: { 'User-Agent': 'GreenConnect-A3/1.0 (+https://greenconnect-a3-66c61.web.app/)', Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  } catch { throw failure(503, 'The map provider could not be reached. Please try again later.') }
  if (!response.ok) throw failure(503, 'The map provider is temporarily unavailable. Please try again later.')
  try { return await response.json() } catch { throw failure(503, 'The map provider returned an unreadable response.') }
}

export const findPlaces = async (query, { db, fetcher = fetch }) => {
  const q = text(query)
  if (q.length < 3 || q.length > 120 || /[\p{Cc}\p{Cf}]/u.test(q)) throw failure(400, 'Enter a place or suburb with 3 to 120 characters.')
  // Cache place results under a query hash. No account ID is attached to the cached result.
  const hash = createHash('sha256').update(q.toLowerCase()).digest('hex')
  const cacheRef = db.doc(`greenconnect/v1/placeCache/${hash}`)
  const cache = (await cacheRef.get()).data()
  if (cache?.expiresAt > Date.now()) return cache.places
  await providerSlot(db, 'photon')
  const url = new URL(process.env.GREENCONNECT_PLACE_URL || 'https://photon.komoot.io/api/')
  // Limit search to the area supported by the event map, then validate each returned coordinate again.
  url.search = new URLSearchParams({ q, limit: '5', lat: '-37.8136', lon: '144.9631', bbox: '144.3,-38.5,145.8,-37.3', lang: 'en' }).toString()
  const data = await fetchJson(url, fetcher)
  if (!Array.isArray(data.features)) throw failure(503, 'The place search response could not be read.')
  const places = data.features.flatMap((feature) => {
    const [longitude, latitude] = feature.geometry?.coordinates || []
    const p = feature.properties || {}
    if (!inMelbourne(latitude, longitude)) return []
    return [{ latitude, longitude, label: [...new Set([p.name, [p.housenumber, p.street].filter(Boolean).join(' '), p.suburb, p.city, p.state].filter(Boolean))].join(', ').slice(0, 300) }]
  }).filter((place) => place.label).slice(0, 5)
  await cacheRef.set({ places, expiresAt: Date.now() + 86400000 })
  return places
}

// The client chooses the origin and event ID. The saved event determines the destination.
export const calculateRoute = async (input, { db, fetcher = fetch }) => {
  const { latitude, longitude, eventId } = input || {}
  if (!inMelbourne(latitude, longitude) || !validId(eventId)) throw failure(400, 'Choose a starting point in greater Melbourne and a valid event.')
  const event = (await db.doc(`greenconnect/v1/events/${eventId}`).get()).data()
  if (!event) throw failure(404, 'This event could not be found.')
  if (!inMelbourne(event.latitude, event.longitude)) throw failure(422, 'This event does not have a usable map location.')
  await providerSlot(db, 'osrm')
  const base = process.env.GREENCONNECT_ROUTE_URL || 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
  const url = new URL(`${longitude},${latitude};${event.longitude},${event.latitude}`, base)
  url.search = 'overview=simplified&geometries=geojson&steps=false'
  const data = await fetchJson(url, fetcher)
  if (data.code === 'NoRoute' || data.code === 'NoSegment') throw failure(422, 'No driving route was found. Try a nearby public place as your starting point.')
  // Check the provider response before exposing geometry or measurements to the frontend.
  const route = data.routes?.[0]
  if (data.code !== 'Ok' || !Number.isFinite(route?.distance) || !Number.isFinite(route?.duration) ||
      route.distance < 0 || route.duration < 0 || route.geometry?.type !== 'LineString' ||
      !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 ||
      route.geometry.coordinates.length > 30000 || route.geometry.coordinates.some((point) => !Array.isArray(point) || !inMelbourne(point[1], point[0]))) {
    throw failure(503, 'The route response could not be read. Please try again later.')
  }
  return { eventId, distanceMetres: route.distance, durationSeconds: route.duration, geometry: route.geometry,
    startSnapMetres: data.waypoints?.[0]?.distance || 0, endSnapMetres: data.waypoints?.[1]?.distance || 0,
    mode: 'driving', provider: 'OSRM / FOSSGIS', includesLiveTraffic: false }
}

export const publicApi = async (req, res, { db = getFirestore(), fetcher = fetch } = {}) => {
  // Public CORS is appropriate for these public event and map routes. It does not grant Firestore access.
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  res.set('X-Content-Type-Options', 'nosniff')
  // Do not cache route coordinates or errors. Only successful public event reads override this setting.
  res.set('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).send('')
  const path = req.path.replace(/\/$/, '')
  try {
    const supported = path === '/api/events' || /^\/api\/events\/[^/]+$/.test(path) || ['/api/places', '/api/route'].includes(path)
    if (!supported) throw failure(404, 'This API route could not be found.')
    if (req.method !== (path === '/api/route' ? 'POST' : 'GET')) {
      res.set('Allow', path === '/api/route' ? 'POST, OPTIONS' : 'GET, OPTIONS')
      throw failure(405, 'This HTTP method is not supported for this route.')
    }
    if (path === '/api/places') return res.json({ places: await findPlaces(req.query.q, { db, fetcher }), attribution: 'OpenStreetMap contributors / Photon by komoot' })
    if (path === '/api/route') return res.json(await calculateRoute(req.body, { db, fetcher }))
    if (path === '/api/events') {
      const filters = eventFilters(req.query)
      // Bound the event read. This small directory filters in memory; a much larger directory needs pagination.
      const snapshot = await db.collection('greenconnect/v1/events').select(...fields).orderBy('startAt').limit(501).get()
      if (snapshot.size > 500) throw failure(503, 'The event directory needs pagination before more events can be returned.')
      const matching = filterEvents(snapshot.docs.map((doc) => publicEvent(doc.id, doc.data())), filters)
      res.set('Cache-Control', 'public, max-age=30')
      return res.json({ events: matching.slice(0, filters.limit), matchingCount: matching.length, returnedCount: Math.min(matching.length, filters.limit) })
    }
    const id = path.split('/').at(-1)
    if (!validId(id)) throw failure(400, 'Invalid event ID.')
    const snapshot = await db.doc(`greenconnect/v1/events/${id}`).get()
    if (!snapshot.exists) throw failure(404, 'This event could not be found.')
    res.set('Cache-Control', 'public, max-age=30')
    return res.json({ event: publicEvent(snapshot.id, snapshot.data()) })
  // Return expected errors as JSON and keep unexpected internal error details out of the public response.
  } catch (error) {
    if (error.status === 429) res.set('Retry-After', '2')
    return res.status(error.status || 500).json({ error: { message: error.status ? error.message : 'The service could not complete this request.' } })
  }
}
