const normalise = (value) => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-AU')
const collator = new Intl.Collator('en-AU', { numeric: true, sensitivity: 'base' })

export const cellText = (row, column) => {
  const value = column.format ? column.format(row[column.key], row) : row[column.key]
  return String(value ?? '')
}

export const filterTable = (rows, columns, search = '', filters = {}) => {
  const global = normalise(search.trim())
  return rows.filter((row) => {
    const values = columns.map((column) => normalise(cellText(row, column)))
    return (!global || values.some((value) => value.includes(global))) && columns.every((column, index) => {
      const filter = normalise((filters[column.key] || '').trim())
      return !filter || values[index].includes(filter)
    })
  })
}

export const sortTable = (rows, columns, sortKey, direction = 'asc') => {
  const column = columns.find((column) => column.key === sortKey)
  if (!column) return [...rows]
  const multiplier = direction === 'desc' ? -1 : 1
  return rows.map((row, index) => ({ row, index })).sort((a, b) => {
    let comparison
    if (column.type === 'number') comparison = Number(a.row[sortKey] ?? 0) - Number(b.row[sortKey] ?? 0)
    else if (column.type === 'date') comparison = (Date.parse(a.row[sortKey]) || 0) - (Date.parse(b.row[sortKey]) || 0)
    else comparison = collator.compare(cellText(a.row, column), cellText(b.row, column))
    return comparison * multiplier || a.index - b.index
  }).map(({ row }) => row)
}

export const tablePage = (rows, requestedPage, size = 10) => {
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  return { page, pageCount, rows: rows.slice((page - 1) * size, page * size) }
}

export const csvCell = (value) => {
  let text = String(value ?? '')
  if (typeof value !== 'number' && /^[\s\p{Cc}\p{Cf}]*[=+\-@]/u.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export const tableCsv = (rows, columns) => '\uFEFF' + [
  columns.map((column) => csvCell(column.label)).join(','),
  ...rows.map((row) => columns.map((column) => csvCell(column.type === 'number' ? row[column.key] : cellText(row, column))).join(',')),
].join('\r\n') + '\r\n'

export const tableSummary = (columns, search, filters, sortKey, sortDirection) => {
  const details = []
  if (search.trim()) details.push(`Search: ${search.trim()}`)
  columns.forEach((column) => { if (filters[column.key]?.trim()) details.push(`${column.label}: ${filters[column.key].trim()}`) })
  const sorted = columns.find((column) => column.key === sortKey)
  details.push(sorted ? `Sort: ${sorted.label} (${sortDirection})` : 'Original order')
  return details.join('; ')
}
