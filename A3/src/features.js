// Enable booking email controls only when the selected environment has a configured mail service.
export const bookingEmailEnabled = import.meta.env.VITE_USE_EMULATORS === 'true' || import.meta.env.VITE_BOOKING_EMAIL_ENABLED === 'true'
// Resend's test sender can deliver only to the service owner's account until a domain is verified.
export const bookingEmailTestMode = import.meta.env.VITE_BOOKING_EMAIL_TEST_MODE === 'true'
