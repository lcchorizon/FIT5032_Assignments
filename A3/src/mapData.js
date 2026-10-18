// Calculate nearby activity distances locally. These distances are not road route distances.
export const validMapPoint = (point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude) &&
  point.latitude >= -38.5 && point.latitude <= -37.3 && point.longitude >= 144.3 && point.longitude <= 145.8
// The Haversine formula estimates surface distance on the Earth from two latitude/longitude points.
export const distanceKm = (a, b) => {
  const rad = (value) => value * Math.PI / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
}
// Exclude unusable coordinates before calculating distance, then apply the radius and sort nearest first.
export const nearbyEvents = (events, origin, radius = 50, query = '', category = '') => events
  .filter(validMapPoint)
  .filter((event) => (!category || event.category === category) &&
    [event.title, event.location, event.category].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  .map((event) => ({ ...event, distanceKm: origin ? distanceKm(origin, event) : null }))
  .filter((event) => !origin || event.distanceKm <= radius)
  .sort((a, b) => origin ? a.distanceKm - b.distanceKm || a.id.localeCompare(b.id) : Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id))
// Provider distance is in metres and duration is in seconds. Round minutes up for the displayed estimate.
export const routeSummary = (route) => `${(route.distanceMetres / 1000).toFixed(1)} km by road · about ${Math.max(1, Math.ceil(route.durationSeconds / 60))} min driving`
