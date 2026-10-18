// Create the email attachment on the server from saved booking details, not a client-uploaded PDF.
import { readFile } from 'node:fs/promises'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Use one field list for the email text and PDF so their booking details agree.
export const receiptRows = (booking, reference) => [
  ['Booking reference', reference], ['Activity', booking.eventTitle],
  ['Name', booking.fullName], ['Email', booking.email],
  ['Starts', formatTime(booking.startAt)], ['Ends', formatTime(booking.endAt)],
  ['Location', booking.location], ['Participants', String(booking.participants)],
  ['Status', 'Confirmed'],
]
const formatTime = (value) => new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Melbourne', dateStyle: 'full', timeStyle: 'short',
}).format(new Date(value)) + ' (Melbourne time)'
const clean = (value) => String(value ?? '').normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, ' ')

export const createReceipt = async (booking, reference, issuedAt) => {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  document.setTitle('GreenConnect booking confirmation')
  document.setAuthor('GreenConnect')
  document.setCreator('GreenConnect')
  // Use the job issue time in the PDF metadata. Retried requests reuse the original stored attachment.
  document.setCreationDate(new Date(issuedAt))
  document.setModificationDate(new Date(issuedAt))
  const latin = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const supported = new Set(latin.getCharacterSet())
  const rows = receiptRows(booking, reference).map(([label, value]) => [label, clean(value)])
  // Embed the custom font only for characters not supported by the standard Latin font.
  const needFont = Array.from(rows.flat().join('')).some((c) => !supported.has(c.codePointAt(0)))
  const custom = needFont ? await document.embedFont(await readFile(new URL('./assets/NotoSansSC-Regular.ttf', import.meta.url)), { subset: true }) : null
  const customSupported = new Set(custom?.getCharacterSet() || [])
  let replaced = false
  // Split mixed-language text by font before measuring and drawing it.
  const runs = (text) => {
    const result = []
    for (let char of Array.from(text)) {
      let font = supported.has(char.codePointAt(0)) ? latin : custom
      if (!supported.has(char.codePointAt(0)) && !customSupported.has(char.codePointAt(0))) {
        char = '?'; font = latin; replaced = true
      }
      const last = result.at(-1)
      if (last?.font === font) last.text += char
      else result.push({ text: char, font })
    }
    return result
  }
  const width = (text) => runs(text).reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, 11), 0)
  const page = document.addPage([595.28, 841.89])
  const draw = (text, x, y) => {
    for (const run of runs(text)) {
      page.drawText(run.text, { x, y, font: run.font, size: 11 })
      x += run.font.widthOfTextAtSize(run.text, 11)
    }
  }
  page.drawText('GreenConnect', { x: 40, y: 790, size: 22, font: bold, color: rgb(.1, .28, .19) })
  page.drawText('Booking confirmation', { x: 40, y: 758, size: 17, font: bold })
  draw('This is a confirmation for a demonstration community activity.', 40, 730)
  let y = 690
  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y, font: bold, size: 10 })
    let line = ''
    for (const char of Array.from(value)) {
      if (line && width(line + char) > 345) { draw(line, 190, y); y -= 17; line = '' }
      line += char
    }
    draw(line, 190, y)
    y -= 32
  }
  if (replaced) draw('Some unsupported symbols are shown as ?.', 40, y - 12)
  draw('You can check or cancel your booking in My bookings.', 40, 95)
  draw('greenconnect-a3-66c61.web.app', 40, 75)
  return Buffer.from(await document.save())
}
