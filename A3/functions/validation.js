// Server validation is needed even when the browser has already checked the same fields.
export const validName = (value) =>
  typeof value === 'string' && value.trim().length >= 3 &&
  value.trim().length <= 50 && !/[<>\p{Cc}]/u.test(value)

// Restrict IDs to one safe path segment; a caller cannot insert slashes to reach another document.
export const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)

export const validParticipants = (value) => Number.isInteger(value) && value >= 1 && value <= 5

export const experienceLevels = ['Beginner', 'Some experience', 'Experienced']
