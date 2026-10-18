// Check PDF attachment generation and the provider request shape without making a real provider request.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { emailPayload, sendWithResend } from '../functions/email.js'

const booking = { eventTitle: 'Planting day', fullName: '李同学 José', email: 'member@example.test',
  startAt: '2099-11-01T10:00:00+11:00', endAt: '2099-11-01T12:00:00+11:00', location: 'Community garden', participants: 2 }

test('booking email contains a readable PDF attachment and the account recipient', async () => {
  const payload = await emailPayload(booking, 'test-reference', Date.UTC(2026, 9, 17), 'GreenConnect <bookings@example.test>')
  assert.deepEqual(payload.to, ['member@example.test'])
  assert.ok(payload.text.includes('李同学 José'))
  assert.ok(payload.text.includes('2'))
  const attachment = payload.attachments[0]
  assert.equal(attachment.content_type, 'application/pdf')
  const pdf = await PDFDocument.load(Buffer.from(attachment.content, 'base64'))
  assert.equal(pdf.getPageCount(), 1)
  assert.equal(pdf.getTitle(), 'GreenConnect booking confirmation')
})

test('provider transport uses a fixed endpoint, server credentials, JSON attachment and idempotency key', async () => {
  const payload = { to: ['member@example.test'], attachments: [{ filename: 'booking.pdf', content: 'cGRm' }] }
  const id = await sendWithResend(payload, 'stable-key', 'test-secret', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(options.headers.Authorization, 'Bearer test-secret')
    assert.equal(options.headers['Idempotency-Key'], 'stable-key')
    assert.deepEqual(JSON.parse(options.body), payload)
    return { ok: true, json: async () => ({ id: 'provider-message' }) }
  })
  assert.equal(id, 'provider-message')
  await assert.rejects(sendWithResend(payload, 'key', 'secret', async () => ({ ok: false })))
  await assert.rejects(sendWithResend(payload, 'key', 'secret', async () => ({ ok: true, json: async () => ({}) })))
})
