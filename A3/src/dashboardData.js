// Keep chart calculations separate from Vue so dates, filters and participant totals can be checked directly.
export const validDay = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
export const shiftDay = (day, amount) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10)

export const dashboardOverview = (snapshot, now = Date.now()) => {
  const events = snapshot.events
  const registrations = snapshot.registrations
  const confirmed = registrations.filter((row) => row.status === 'confirmed')
  const upcoming = events
    .filter((event) => Date.parse(event.startAt) > now)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  const reserved = events.reduce((sum, event) => sum + (event.bookedPlaces || 0), 0)
  const participants = confirmed.reduce((sum, row) => sum + row.participants, 0)
  return {
    events: events.length,
    records: registrations.length,
    confirmed: confirmed.length,
    cancelled: registrations.filter((row) => row.status === 'cancelled').length,
    interests: registrations.filter((row) => row.status === 'interest').length,
    participants,
    reserved,
    upcoming: upcoming.length,
    remaining: upcoming.reduce(
      (sum, event) => sum + Math.max(0, event.capacity - (event.bookedPlaces || 0)),
      0,
    ),
    // Compare the booking records and event counters without silently choosing one when they disagree.
    capacityMismatch: reserved !== participants,
    upcomingEvents: upcoming.map((event) => ({
      ...event,
      available: Math.max(0, event.capacity - (event.bookedPlaces || 0)),
      occupancy:
        event.capacity > 0 ? Math.round(((event.bookedPlaces || 0) / event.capacity) * 100) : 0,
    })),
  }
}

export const analyseBookings = (
  snapshot,
  { from, to, category = '', groupBy = 'event', metric = 'participants' },
) => {
  if (!validDay(from) || !validDay(to) || from > to)
    throw new Error('Choose a valid start and end date, with the start date first.')
  const numberOfDays =
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1
  if (numberOfDays > 366) throw new Error('Choose a date range of 366 days or less.')
  const byId = new Map(snapshot.events.map((event) => [event.id, event]))
  const dates = Array.from({ length: numberOfDays }, (_, index) => ({
    day: shiftDay(from, index),
    confirmed: 0,
    cancelled: 0,
    interest: 0,
    other: 0,
  }))
  const dateMap = new Map(dates.map((day) => [day.day, day]))
  const groups = new Map()
  // Keep zero-value events in the ranking so the admin can also find activities with no bookings.
  for (const event of snapshot.events.filter((event) => !category || event.category === category)) {
    const key = groupBy === 'category' ? event.category || 'Uncategorised' : event.id
    if (!groups.has(key))
      groups.set(key, {
        key,
        label: groupBy === 'category' ? key : event.title,
        bookings: 0,
        participants: 0,
      })
  }
  let excludedDates = 0
  let matching = 0
  let confirmed = 0
  let participants = 0
  for (const row of snapshot.registrations) {
    const event = byId.get(row.eventId)
    if (category && event?.category !== category) continue
    if (!validDay(row.createdDay)) {
      excludedDates++
      continue
    }
    if (row.createdDay < from || row.createdDay > to) continue
    matching++
    const day = dateMap.get(row.createdDay)
    if (['confirmed', 'cancelled', 'interest'].includes(row.status)) day[row.status]++
    else day.other++
    if (row.status !== 'confirmed') continue
    confirmed++
    participants += row.participants
    const key = groupBy === 'category' ? event?.category || 'Unavailable event' : row.eventId
    if (!groups.has(key))
      groups.set(key, {
        key,
        label: event?.title || 'Unavailable event',
        bookings: 0,
        participants: 0,
      })
    const group = groups.get(key)
    group.bookings++
    group.participants += row.participants
  }
  const ranking = [...groups.values()]
    .map((group) => ({
      ...group,
      value: group[metric === 'bookings' ? 'bookings' : 'participants'],
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  return { dates, ranking, matching, confirmed, participants, excludedDates }
}
