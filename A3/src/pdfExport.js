// Build a table PDF in the browser from the same filtered rows used on screen.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { cellText } from './tableData.js'

let fontPromise
// Cache the font download and allow a later retry if the first download fails.
export const loadExportFont = () => {
  if (!fontPromise) {
    fontPromise = fetch(new URL('./assets/fonts/NotoSansSC-Regular.ttf', import.meta.url)).then((response) => {
      if (!response.ok) throw new Error('The PDF font could not be loaded. Please try again.')
      return response.arrayBuffer()
    }).catch((error) => { fontPromise = null; throw error })
  }
  return fontPromise
}

const clean = (text) => String(text ?? '').normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, ' ')
// Measure text before drawing it so long values wrap inside the column width.
const wrap = (text, font, size, width) => {
  const lines = []
  let line = ''
  for (const character of Array.from(text)) {
    if (line && font.widthOfTextAtSize(line + character, size) > width) {
      const breakAt = line.lastIndexOf(' ')
      if (breakAt > line.length / 2) {
        lines.push(line.slice(0, breakAt))
        line = line.slice(breakAt + 1) + character
      } else {
        lines.push(line)
        line = character === ' ' ? '' : character
      }
    } else line += character
  }
  lines.push(line)
  return lines
}

export const createTablePdf = async ({ title, rows, columns, description = '', summary = '', fontBytes, exportedAt = new Date() }) => {
  if (!rows.length) throw new Error('There are no matching records to export.')
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  // Use Helvetica for Latin text and Noto Sans SC for characters such as Chinese names.
  // Keeping Latin text in the standard font also avoids the custom-font spacing issue.
  const latinFont = await document.embedFont(StandardFonts.Helvetica)
  const headingFont = await document.embedFont(StandardFonts.HelveticaBold)
  const latinCharacters = new Set(latinFont.getCharacterSet())
  const rawBody = rows.map((row) => columns.map((column) => clean(cellText(row, column))))
  const needsCustomFont = Array.from(rawBody.flat().join('') + description + summary).some((character) => !latinCharacters.has(character.codePointAt(0)))
  // Only fetch and embed the larger font when the exported text needs it. Subsetting keeps the PDF smaller.
  const customFont = needsCustomFont ? await document.embedFont(fontBytes || await loadExportFont(), { subset: true }) : null
  const characters = new Set([...latinCharacters, ...(customFont?.getCharacterSet() || [])])
  // A line can contain both fonts. Group neighbouring characters so each part uses the right font and width.
  const runs = (text) => {
    const result = []
    for (const character of Array.from(text)) {
      const font = latinCharacters.has(character.codePointAt(0)) ? latinFont : customFont
      const last = result[result.length - 1]
      if (last?.font === font) last.text += character
      else result.push({ font, text: character })
    }
    return result
  }
  const font = { widthOfTextAtSize: (text, size) => runs(text).reduce((width, run) => width + run.font.widthOfTextAtSize(run.text, size), 0) }
  const drawText = (page, text, options) => {
    let x = options.x
    for (const run of runs(text)) {
      page.drawText(run.text, { ...options, x, font: run.font })
      x += run.font.widthOfTextAtSize(run.text, options.size)
    }
  }
  let replacements = false
  // Unsupported symbols become ? with a notice. CSV remains available with the original text.
  const safe = (value) => Array.from(clean(value)).map((character) => {
    if (characters.has(character.codePointAt(0))) return character
    replacements = true
    return '?'
  }).join('')
  const body = rawBody.map((cells) => cells.map(safe))
  const subtitle = safe(`${description} ${summary}`.trim())
  const exported = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', dateStyle: 'medium', timeStyle: 'short' }).format(exportedAt)
  const margin = 30
  const [width, height] = [841.89, 595.28]
  const tableWidth = width - margin * 2
  const weight = columns.reduce((sum, column) => sum + (column.weight || 1), 0)
  const widths = columns.map((column) => tableWidth * (column.weight || 1) / weight)
  const fontSize = 8.5
  const lineHeight = 12
  const headerLines = columns.map((column, index) => wrap(safe(column.label), font, fontSize, widths[index] - 12))
  const headerHeight = Math.max(...headerLines.map((lines) => lines.length)) * lineHeight + 12
  const summaryLines = wrap(subtitle, font, 8, tableWidth)
  const note = replacements ? 'Some unsupported symbols are shown as ?. CSV keeps the original text.' : ''
  let page
  let y
  const drawCells = (cells, rowHeight, header = false, alternate = false) => {
    let x = margin
    cells.forEach((lines, index) => {
      page.drawRectangle({ x, y: y - rowHeight, width: widths[index], height: rowHeight,
        color: header ? rgb(.1, .28, .19) : alternate ? rgb(.95, .97, .95) : rgb(1, 1, 1),
        borderColor: rgb(.81, .85, .82), borderWidth: .5 })
      lines.forEach((line, lineIndex) => drawText(page, line, {
        x: x + 6, y: y - 15 - lineIndex * lineHeight, size: fontSize,
        color: header ? rgb(1, 1, 1) : rgb(.12, .16, .13),
      }))
      x += widths[index]
    })
    y -= rowHeight
  }
  // Repeat the title, filter summary and column headings so each printed page can be understood on its own.
  const newPage = () => {
    page = document.addPage([width, height])
    page.drawText('GreenConnect', { x: margin, y: height - 35, size: 11, font: headingFont, color: rgb(.1, .28, .19) })
    page.drawText(clean(title), { x: margin, y: height - 58, size: 16, font: headingFont })
    drawText(page, `${rows.length} matching record(s) | Exported ${exported} (Melbourne time)`, { x: margin, y: height - 76, size: 8 })
    summaryLines.forEach((line, index) => drawText(page, line, { x: margin, y: height - 91 - index * 11, size: 8 }))
    y = height - 105 - summaryLines.length * 11
    if (note) { drawText(page, note, { x: margin, y, size: 8 }); y -= 18 }
    drawCells(headerLines, headerHeight, true)
  }
  newPage()
  let rowsOnPage = 0
  body.forEach((cells, index) => {
    const lines = cells.map((text, column) => wrap(text, font, fontSize, widths[column] - 12))
    const rowHeight = Math.max(...lines.map((value) => value.length)) * lineHeight + 12
    if (rowHeight > height - 210 - summaryLines.length * 11) throw new Error('One record is too long for the PDF layout. Please export it as CSV.')
    // Start a page before the row reaches the footer, or after ten rows.
    if (y - rowHeight < 38 || rowsOnPage === 10) { newPage(); rowsOnPage = 0 }
    drawCells(lines, rowHeight, false, index % 2 === 1)
    rowsOnPage += 1
  })
  const pages = document.getPages()
  pages.forEach((page, index) => drawText(page, `Page ${index + 1} of ${pages.length}`, { x: margin, y: 19, size: 8 }))
  document.setTitle(title)
  document.setAuthor('GreenConnect')
  document.setCreator('GreenConnect')
  return { bytes: await document.save(), replacements }
}
