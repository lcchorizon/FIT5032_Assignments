export const errorMessage = (error) => {
  const messages = {
    'auth/email-already-in-use': 'An account already exists for this email address.',
    'auth/invalid-credential': 'The email address or password is incorrect.',
    'auth/user-not-found': 'The email address or password is incorrect.',
    'auth/wrong-password': 'The email address or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/network-request-failed': 'Could not connect. Check your connection and try again.',
    'functions/aborted': 'Another booking changed at the same time. Please try again.',
    'functions/deadline-exceeded': 'The request timed out. Check My bookings before trying again.',
    'functions/unavailable': 'The service is unavailable. Please try again shortly.',
    'functions/unauthenticated': 'Please log in to continue.',
    'permission-denied': 'You do not have access to these records.',
    unavailable: 'Could not load data. Check your connection and try again.',
  }
  if (messages[error?.code]) return messages[error.code]
  if (['functions/invalid-argument', 'functions/failed-precondition',
    'functions/already-exists', 'functions/not-found', 'functions/resource-exhausted'].includes(error?.code)) return error.message.replace(/\s*\[\d{3}\]$/, '')
  return 'The request could not be completed. Please try again.'
}
