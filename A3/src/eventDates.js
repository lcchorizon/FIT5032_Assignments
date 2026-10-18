// Use Melbourne time for activity dates, even when the visitor is in another timezone.
const zone = 'Australia/Melbourne'
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })

// Build a YYYY-MM-DD key from Melbourne date parts rather than the browser's local day.
export const melbourneDay = (value = new Date()) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = Object.fromEntries(dayFormat.formatToParts(date).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const eventTime = (start, end) => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return 'Time to be confirmed'
  const date = new Intl.DateTimeFormat('en-AU', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(startDate)
  const time = new Intl.DateTimeFormat('en-AU', { timeZone: zone, hour: 'numeric', minute: '2-digit' })
  const endDay = melbourneDay(start) === melbourneDay(end) ? '' : `${new Intl.DateTimeFormat('en-AU', { timeZone: zone, day: 'numeric', month: 'short' }).format(endDate)} `
  return `${date}, ${time.format(startDate)} – ${endDay}${time.format(endDate)} (Melbourne time)`
}

// A fixed six-week grid starts on Monday. UTC arithmetic avoids daylight-saving shifts in these date-only cells.
export const monthDays = (year, month) => {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, index - offset + 1))
    return { key: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month }
  })
}
