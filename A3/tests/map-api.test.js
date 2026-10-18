// Check nearby distances, public field selection and API parameter validation without network calls.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distanceKm, nearbyEvents, routeSummary } from '../src/mapData.js'
import { eventFilters, filterEvents, inMelbourne, publicEvent } from '../functions/publicApi.js'

const events = [
  { id: 'near', title: 'Tree planting', location: 'Garden', category: 'Planting', latitude: -37.81, longitude: 144.96, startAt: '2099-01-01T10:00:00Z', availablePlaces: 3, familyFriendly: true },
  { id: 'far', title: 'Habitat care', location: 'Clayton', category: 'Planting', latitude: -37.915, longitude: 145.121, startAt: '2099-01-03T10:00:00Z', availablePlaces: 0, familyFriendly: false },
  { id: 'missing', title: 'Workshop', location: 'Unknown', category: 'Education', startAt: '2099-01-02T10:00:00Z', availablePlaces: 5, familyFriendly: true },
]
test('nearby discovery uses kilometres, radius and composed activity filters', () => {
  const origin = { latitude: -37.8136, longitude: 144.9631 }
  assert.ok(distanceKm(origin, events[0]) < 1)
  assert.ok(distanceKm(origin, events[1]) > 10)
  assert.deepEqual(nearbyEvents(events, origin, 5).map((event) => event.id), ['near'])
  assert.deepEqual(nearbyEvents(events, origin, 100, 'clayton', 'Planting').map((event) => event.id), ['far'])
  assert.equal(nearbyEvents(events, origin, 100, 'clayton', 'Education').length, 0)
  assert.deepEqual(nearbyEvents(events, null).map((event) => event.id), ['near', 'far'])
  assert.equal(events[0].distanceKm, undefined)
  assert.equal(distanceKm(origin, origin), 0)
})
test('routing boundaries reject non-numeric and out-of-area coordinates', () => {
  assert.equal(inMelbourne(-37.81, 144.96), true)
  for (const [lat, lon] of [[0, 0], [-37.8, '144.9'], [NaN, 144.9], [-38.6, 145]]) assert.equal(inMelbourne(lat, lon), false)
  assert.equal(routeSummary({ distanceMetres: 12345, durationSeconds: 1210 }), '12.3 km by road · about 21 min driving')
})
test('public event serialization never includes private or unexpected document fields', () => {
  const result = publicEvent('id', { ...events[0], capacity: 4, bookedPlaces: 3, email: 'private@example.test', profile: { secret: true }, ratings: { member: 1 }, registration: 'private' })
  assert.equal(result.availablePlaces, 1)
  assert.equal(result.email, undefined)
  assert.equal(result.profile, undefined)
  assert.equal(result.registration, undefined)
  assert.equal(result.ratings, undefined)
  assert.equal(result.latitude, -37.81)
})
test('REST filters compose and preserve true/false semantics with sorted results', () => {
  assert.deepEqual(filterEvents(events, eventFilters({ category: 'Planting', available: 'false', familyFriendly: 'false' })).map((event) => event.id), ['far'])
  assert.deepEqual(filterEvents(events, eventFilters({ q: 'Garden', from: '2099-01-01T00:00:00Z' })).map((event) => event.id), ['near'])
  assert.equal(eventFilters({ limit: '2' }).limit, 2)
})
test('REST inputs reject malformed, repeated and unsupported filters', () => {
  for (const input of [{ limit: '0' }, { limit: '101' }, { limit: '2.5' }, { familyFriendly: 'yes' }, { from: 'tomorrow' }, { from: '2099-01-01' }, { q: ['one', 'two'] }, { userId: 'someone' }, { q: 'a'.repeat(121) }]) {
    assert.throws(() => eventFilters(input), (error) => error.status === 400)
  }
})
