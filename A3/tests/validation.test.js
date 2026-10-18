// Check the server validators with valid international names and invalid booking inputs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validName, validId, validParticipants } from '../functions/validation.js'

test('names accept international text and reject markup or control characters', () => {
  assert.equal(validName('李同学'), true)
  assert.equal(validName("Anne-Marie O'Neil"), true)
  for (const value of ['', 'ab', '<script>', 'A\nB', 'a'.repeat(51), null, {}]) {
    assert.equal(validName(value), false)
  }
})
test('event IDs cannot change document paths', () => {
  assert.equal(validId('event-12'), true)
  for (const value of ['../profiles', 'a/b', '', {}, 'a'.repeat(81)]) assert.equal(validId(value), false)
})
test('participant limits reject fractions and coercible strings', () => {
  for (const value of [1, 5]) assert.equal(validParticipants(value), true)
  for (const value of [0, 6, 1.5, '2', null]) assert.equal(validParticipants(value), false)
})
