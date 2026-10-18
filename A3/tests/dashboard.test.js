// Check chart totals independently of Vue and Chart.js, especially cancellation and date boundaries.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyseBookings, dashboardOverview, validDay } from '../src/dashboardData.js'

const snapshot = {
  events: [
    {
      id: 'a',
      title: 'Planting',
      category: 'Nature',
      capacity: 10,
      bookedPlaces: 3,
      startAt: '2099-01-01T00:00:00Z',
    },
    {
      id: 'b',
      title: 'Workshop',
      category: 'Education',
      capacity: 5,
      bookedPlaces: 0,
      startAt: '2020-01-01T00:00:00Z',
    },
    {
      id: 'c',
      title: 'Walk',
      category: 'Nature',
      capacity: 8,
      bookedPlaces: 1,
      startAt: '2099-01-02T00:00:00Z',
    },
  ],
  registrations: [
    { eventId: 'a', status: 'confirmed', participants: 3, createdDay: '2026-10-01' },
    { eventId: 'c', status: 'confirmed', participants: 1, createdDay: '2026-10-02' },
    { eventId: 'a', status: 'cancelled', participants: 2, createdDay: '2026-10-01' },
    { eventId: 'b', status: 'interest', participants: 4, createdDay: '2026-10-02' },
    { eventId: 'b', status: 'interest', participants: 1, createdDay: null },
  ],
}
const filters = { from: '2026-10-01', to: '2026-10-03' }
test('operational totals distinguish records and participant places; past capacity is excluded from upcoming availability', () => {
  const result = dashboardOverview(snapshot, Date.parse('2026-10-18T00:00:00Z'))
  assert.equal(result.confirmed, 2)
  assert.equal(result.participants, 4)
  assert.equal(result.cancelled, 1)
  assert.equal(result.interests, 2)
  assert.equal(result.remaining, 14)
  assert.equal(result.upcoming, 2)
  assert.equal(result.capacityMismatch, false)
  assert.equal(
    dashboardOverview({
      ...snapshot,
      events: snapshot.events.map((event) => ({ ...event, bookedPlaces: 0 })),
    }).capacityMismatch,
    true,
  )
})
test('time chart includes zero days and separates current statuses from participant totals', () => {
  const result = analyseBookings(snapshot, filters)
  assert.equal(result.matching, 4)
  assert.equal(result.confirmed, 2)
  assert.equal(result.participants, 4)
  assert.equal(result.excludedDates, 1)
  assert.deepEqual(result.dates[0], {
    day: '2026-10-01',
    confirmed: 1,
    cancelled: 1,
    interest: 0,
    other: 0,
  })
  assert.equal(result.dates[2].confirmed, 0)
  assert.equal(result.ranking.find((row) => row.key === 'b').value, 0)
})
test('category, date, grouping and measure combine without mutating the source snapshot', () => {
  const before = JSON.stringify(snapshot)
  const result = analyseBookings(snapshot, {
    ...filters,
    to: '2026-10-01',
    category: 'Nature',
    groupBy: 'category',
    metric: 'bookings',
  })
  assert.equal(result.matching, 2)
  assert.deepEqual(result.ranking[0], {
    key: 'Nature',
    label: 'Nature',
    bookings: 1,
    participants: 3,
    value: 1,
  })
  assert.equal(JSON.stringify(snapshot), before)
})
test('empty data, leap dates and invalid or oversized ranges have explicit results', () => {
  assert.equal(analyseBookings({ events: [], registrations: [] }, filters).matching, 0)
  assert.equal(validDay('2024-02-29'), true)
  assert.equal(validDay('2026-02-29'), false)
  for (const range of [
    { from: '', to: '2026-10-01' },
    { from: '2026-10-02', to: '2026-10-01' },
    { from: '2020-01-01', to: '2026-10-01' },
  ])
    assert.throws(() => analyseBookings(snapshot, range))
})
