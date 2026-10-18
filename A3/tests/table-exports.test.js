// Check combined table filters, sort order, pagination and safe CSV output.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterTable, sortTable, tablePage, tableCsv, csvCell } from '../src/tableData.js'

const columns = [{ key: 'name', label: 'Name' }, { key: 'group', label: 'Group' }, { key: 'count', label: 'Count', type: 'number' }]
const rows = [{ id: 'a', name: 'José Lee', group: 'Planting', count: 10 }, { id: 'b', name: '李同学', group: 'Planting', count: 2 }, { id: 'c', name: 'Jo Taylor', group: 'Education', count: 1 }]

test('global search and per-column filters combine without losing Unicode values', () => {
  assert.deepEqual(filterTable(rows, columns, 'JOSE').map((row) => row.id), ['a'])
  assert.deepEqual(filterTable(rows, columns, 'plant', { name: '李' }).map((row) => row.id), ['b'])
  assert.deepEqual(filterTable(rows, columns, '', { group: 'plant', count: '10' }).map((row) => row.id), ['a'])
  assert.equal(filterTable(rows, columns, 'missing').length, 0)
  assert.equal(filterTable([{}], columns, 'test').length, 0)
})
test('numeric sorting uses numeric values and does not mutate the source', () => {
  assert.deepEqual(sortTable(rows, columns, 'count').map((row) => row.count), [1, 2, 10])
  assert.deepEqual(sortTable(rows, columns, 'count', 'desc').map((row) => row.count), [10, 2, 1])
  assert.deepEqual(rows.map((row) => row.count), [10, 2, 1])
})
test('pagination stays at ten rows and clamps after the matching data shrinks', () => {
  const data = Array.from({ length: 23 }, (_, id) => ({ id }))
  assert.equal(tablePage(data, 1).rows.length, 10)
  assert.deepEqual(tablePage(data, 3).rows.map((row) => row.id), [20, 21, 22])
  assert.equal(tablePage(data.slice(0, 4), 3).page, 1)
  assert.deepEqual(tablePage([], 2), { page: 1, pageCount: 1, rows: [] })
})
test('CSV quotes commas, quotes and line breaks, preserves Unicode and neutralises formula text', () => {
  assert.equal(csvCell('A, "B"\nC'), '"A, ""B""\nC"')
  assert.equal(csvCell('=SUM(1,2)'), '"\'=SUM(1,2)"')
  assert.equal(csvCell(' \t@command'), '"\' \t@command"')
  assert.equal(csvCell('-10'), '"\'-10"')
  assert.equal(csvCell('\uFEFF=1+1'), '"\'\uFEFF=1+1"')
  assert.equal(csvCell(-10), '"-10"')
  const csv = tableCsv(rows, columns)
  assert.ok(csv.startsWith('\uFEFF"Name","Group","Count"\r\n'))
  assert.ok(csv.includes('José Lee'))
  assert.ok(csv.includes('李同学'))
})
test('export receives all filtered and sorted rows rather than just the current page', () => {
  const data = Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: `Member ${index}`, group: 'Planting', count: index + 1 }))
  const matching = sortTable(filterTable(data, columns, 'plant'), columns, 'count', 'desc')
  assert.equal(tablePage(matching, 1).rows.length, 10)
  const csv = tableCsv(matching, columns)
  assert.equal(csv.trim().split('\r\n').length, 13)
  assert.ok(csv.indexOf('Member 11') < csv.indexOf('Member 0'))
})
