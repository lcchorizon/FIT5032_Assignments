import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { createTablePdf } from '../src/pdfExport.js'
import { eventColumns, registrationColumns } from '../src/tableColumns.js'
import { sortTable, tableCsv } from '../src/tableData.js'

const output = process.argv[2] || '/private/tmp/greenconnect-a3-export-review'
await mkdir(output, { recursive: true })
const fontBytes = await readFile(new URL('../src/assets/fonts/NotoSansSC-Regular.ttf', import.meta.url))
const events = JSON.parse(await readFile(new URL('../src/assets/json/events.json', import.meta.url), 'utf8'))
const registrations = JSON.parse(await readFile(new URL('../src/assets/json/registration-examples.json', import.meta.url), 'utf8'))
for (const [id, title, rows, columns, description] of [
  ['events', 'Community events', events, eventColumns, 'Demonstration community activities. Dates and times use Melbourne time.'],
  ['registration-examples', 'Demonstration registration records', registrations, registrationColumns, 'Fictional example records. These records do not reserve places.'],
]) {
  const ordered = sortTable(rows, columns, columns[0].key)
  const result = await createTablePdf({ title, rows: ordered, columns, description, summary: `Sort: ${columns[0].label} (asc)`, fontBytes })
  const file = join(output, `${id}.pdf`)
  await writeFile(file, result.bytes)
  await writeFile(join(output, `${id}.csv`), tableCsv(ordered, columns), 'utf8')
  const document = await PDFDocument.load(result.bytes)
  if (document.getPageCount() < 2 || result.replacements) throw new Error('PDF export did not preserve the expected multipage example data.')
  console.log(`${id}: ${rows.length} rows, ${document.getPageCount()} PDF pages; CSV and PDF saved for inspection.`)
}
