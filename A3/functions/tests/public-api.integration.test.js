// Use emulator event documents and controlled provider responses to check the API and shared rate gate.
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { publicApi, findPlaces, calculateRoute, providerSlot } from '../publicApi.js'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('These checks require the local Firestore emulator.')
initializeApp({ projectId: 'demo-greenconnect-a3' })
const db = getFirestore()
const root = db.doc('greenconnect/v1')
const id = `api-check-${crypto.randomUUID()}`
const fixture = { title: 'Public API test activity', category: 'API check', description: 'Test fixture', location: 'Test garden',
  latitude: -37.82, longitude: 144.97, startAt: '2099-01-01T10:00:00Z', endAt: '2099-01-01T12:00:00Z',
  capacity: 10, bookedPlaces: 2, familyFriendly: true, isDemo: true, email: 'private@example.test', userId: 'private-user' }
const placeQuery = `API test place ${id}`
before(async () => {
  await root.collection('events').doc(id).set(fixture)
  await Promise.all(['photon', 'osrm', 'test-provider'].map((name) => root.collection('mapServiceLimits').doc(name).delete()))
})
after(async () => {
  await root.collection('events').doc(id).delete()
  await root.collection('placeCache').doc(createHash('sha256').update(placeQuery.toLowerCase()).digest('hex')).delete()
  await Promise.all(['photon', 'osrm', 'test-provider'].map((name) => root.collection('mapServiceLimits').doc(name).delete()))
})
const call = async (path, { method = 'GET', query = {}, body } = {}) => {
  const response = { code: 200, headers: {}, status(code) { this.code = code; return this }, set(key, value) { this.headers[key] = value; return this },
    json(data) { this.data = data; return this }, send(data) { this.data = data; return this } }
  await publicApi({ path, method, query, body }, response, { db })
  return response
}
test('public list and detail API expose public fields only, including live capacity', async () => {
  const list = await call('/api/events', { query: { category: fixture.category, available: 'true', limit: '1' } })
  assert.equal(list.code, 200)
  assert.equal(list.data.events.length, 1)
  assert.equal(list.data.events[0].id, id)
  assert.equal(list.data.events[0].availablePlaces, 8)
  assert.equal(list.data.events[0].email, undefined)
  const detail = await call(`/api/events/${id}`)
  assert.equal(detail.code, 200)
  assert.equal(detail.data.event.userId, undefined)
  assert.equal(detail.data.event.title, fixture.title)
})
test('HTTP errors are JSON and do not expose other collections or accept unsupported methods', async () => {
  assert.equal((await call('/api/profiles')).code, 404)
  assert.equal((await call('/api/events/missing-test-id')).code, 404)
  assert.equal((await call('/api/events', { query: { available: 'yes' } })).code, 400)
  assert.equal((await call('/api/events', { method: 'POST' })).code, 405)
  const preflight = await call('/api/events', { method: 'OPTIONS' })
  assert.equal(preflight.code, 204)
  assert.equal(preflight.headers['Access-Control-Allow-Origin'], '*')
})
test('provider rate gate serializes simultaneous calls across function instances', async () => {
  const results = await Promise.allSettled([providerSlot(db, 'test-provider', 10000), providerSlot(db, 'test-provider', 10000)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.status, 429)
})
test('place proxy validates and bounds results, then serves repeated searches from cache', async () => {
  let requests = 0
  const fetcher = async (url, options) => {
    requests++
    assert.equal(url.hostname, 'photon.komoot.io')
    assert.equal(url.searchParams.get('q'), placeQuery)
    assert.ok(options.headers['User-Agent'].includes('GreenConnect'))
    return { ok: true, json: async () => ({ features: [
      { geometry: { coordinates: [144.96, -37.81] }, properties: { name: 'Test public landmark', city: 'Melbourne' } },
      { geometry: { coordinates: [0, 0] }, properties: { name: 'Outside Melbourne' } },
    ] }) }
  }
  assert.equal((await findPlaces(placeQuery, { db, fetcher })).length, 1)
  assert.equal((await findPlaces(placeQuery, { db, fetcher }))[0].label, 'Test public landmark, Melbourne')
  assert.equal(requests, 1)
  await assert.rejects(findPlaces('a', { db, fetcher }), (error) => error.status === 400)
})
test('route proxy reads the real event destination and rejects invalid inputs and provider failures', async () => {
  const input = { latitude: -37.81, longitude: 144.96, eventId: id, destination: [0, 0] }
  const fetcher = async (url) => {
    assert.ok(url.pathname.endsWith(`144.96,-37.81;${fixture.longitude},${fixture.latitude}`))
    return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 1500, duration: 300, geometry: { type: 'LineString', coordinates: [[144.96, -37.81], [144.97, -37.82]] } }], waypoints: [{ distance: 2 }, { distance: 4 }] }) }
  }
  const route = await calculateRoute(input, { db, fetcher })
  assert.equal(route.distanceMetres, 1500)
  assert.equal(route.includesLiveTraffic, false)
  await assert.rejects(calculateRoute({ ...input, latitude: 0 }, { db, fetcher }), (error) => error.status === 400)
  await root.collection('mapServiceLimits').doc('osrm').delete()
  await assert.rejects(calculateRoute(input, { db, fetcher: async () => ({ ok: true, json: async () => ({ code: 'NoRoute' }) }) }), (error) => error.status === 422)
  await root.collection('mapServiceLimits').doc('osrm').delete()
  await assert.rejects(calculateRoute(input, { db, fetcher: async () => { throw new Error('simulated network failure') } }), (error) => error.status === 503)
})
