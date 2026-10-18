// Keep unfinished email controls hidden in production while allowing local review.
export const bookingEmailEnabled = import.meta.env.VITE_USE_EMULATORS === 'true' || import.meta.env.VITE_BOOKING_EMAIL_ENABLED === 'true'
