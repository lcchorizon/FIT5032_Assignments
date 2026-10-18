// Check calendar dates and time overlap boundaries, including Melbourne timezone behaviour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { intervalsOverlap } from '../functions/bookings.js'
import { melbourneDay, monthDays } from '../src/eventDates.js'

test('touching event boundaries are allowed while nested time ranges conflict', () => {
  assert.equal(intervalsOverlap(10, 12, 12, 14), false)
  assert.equal(intervalsOverlap(10, 12, 8, 10), false)
  assert.equal(intervalsOverlap(10, 12, 11, 13), true)
  assert.equal(intervalsOverlap(10, 12, 9, 13), true)
})
test('calendar dates use Melbourne even when the UTC day differs or daylight saving changes', () => {
  assert.equal(melbourneDay('2026-11-06T14:00:00Z'), '2026-11-07')
  assert.equal(melbourneDay('2026-07-06T13:30:00Z'), '2026-07-06')
  assert.equal(melbourneDay('2026-10-03T16:30:00Z'), '2026-10-04')
  assert.equal(melbourneDay('invalid'), '')
})
test('month view aligns Monday to Sunday and handles leap years', () => {
  const november = monthDays(2026, 10)
  assert.equal(november[0].key, '2026-10-26')
  assert.equal(november[6].key, '2026-11-01')
  assert.equal(november[41].key, '2026-12-06')
  assert.equal(november.filter((day) => day.inMonth).length, 30)
  assert.equal(monthDays(2028, 1).filter((day) => day.inMonth).length, 29)
})
