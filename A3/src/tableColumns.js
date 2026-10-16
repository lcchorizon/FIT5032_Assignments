import { eventTime } from './eventDates.js'

const bookingStatus = { confirmed: 'Confirmed', cancelled: 'Cancelled', interest: 'Interest only' }
export const eventColumns = [
  { key: 'title', label: 'Event', weight: 1.7 },
  { key: 'category', label: 'Category', weight: 1 },
  { key: 'startAt', label: 'Date and time', type: 'date', weight: 1.8, format: (value, row) => eventTime(value, row.endAt) },
  { key: 'location', label: 'Location', weight: 1.4 },
  { key: 'capacity', label: 'Capacity', type: 'number', weight: .65 },
  { key: 'availablePlaces', label: 'Available', type: 'number', weight: .65 },
  { key: 'familyFriendly', label: 'Family friendly', weight: .8, format: (value) => value ? 'Yes' : 'No' },
]
export const registrationColumns = [
  { key: 'eventTitle', label: 'Event', weight: 1.6 },
  { key: 'fullName', label: 'Full name', weight: 1 },
  { key: 'email', label: 'Email', weight: 1.7 },
  { key: 'startAt', label: 'Date and time', type: 'date', weight: 1.9, format: (value, row) => value ? eventTime(value, row.endAt) : 'Not confirmed' },
  { key: 'participants', label: 'Participants', type: 'number', weight: .8 },
  { key: 'status', label: 'Status', weight: .85, format: (value) => bookingStatus[value] || value || 'Unknown' },
  { key: 'experienceLevel', label: 'Experience', weight: 1 },
]
