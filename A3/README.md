# GreenConnect A3

I am extending my A1.3 application for community environmental activities in Melbourne. The sample activities are demonstration data, rather than real advertised events.

## Current features

- Firebase Authentication accounts with registration, login, logout and session restoration
- Firestore profiles and member/admin access using a signed `greenconnectAdmin` claim
- Searchable event cards with category and family-friendly filters
- Event directory and admin registration tables with sorting, column filters and 10 rows per page
- Event map with public-place search, nearby activity filters and driving route distance and duration
- Public event list and detail REST routes, with field filtering and JSON errors
- An admin dashboard with account role counts, activity capacity and interactive booking analysis
- CSV and PDF exports of all matching records in their current sort order
- Activity calendar with Melbourne dates and times
- Confirmed group bookings with server-side capacity, duplicate and overlap checks
- Cancellation before the event starts, with places released for other members
- Cloud Function validation for bookings and event ratings
- Personal registration records and an admin records page
- One rating per account for each event, with public rating totals
- Email verification and booking confirmation requests with a server-generated PDF attachment
- Firestore rules that block direct client changes to profiles, events, ratings and registrations

Bookings reserve places only after the server transaction succeeds. Events that overlap an existing confirmed booking are rejected. An event can start when another ends. Earlier interest records remain visible as interests until the member completes a booking.

## Local setup

Use Node 22.18+ or Node 24.12+, npm and Java 21+ for the Firebase emulators. Deployed functions use Node 22.

```sh
npm ci
npm ci --prefix functions
```

Create `.env.development.local` containing:

```properties
VITE_USE_EMULATORS=true
VITE_FUNCTIONS_REGION=us-central1
```

Start the local backend:

```sh
npm run emulators
```

In a second terminal, add local examples and start the site:

```sh
npm run seed:emulators
npm run dev
```

Local demo accounts only:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@example.test | LocalDemo123! |
| Member | member@example.test | LocalDemo123! |

These accounts exist only in the demo emulator project. The seed script cannot create them in a cloud project. Emulator data is kept locally and is excluded from Git.

## Checks

```sh
npm run lint
npm test
npm run test:emulators
npm run build
```

Stop any running emulators before `test:emulators`. The integration suite uses an isolated demo project and resets its local test data. It checks anonymous access, member/admin boundaries, role escalation attempts, caller identity, duplicate bookings, past events and rating updates. It also tests concurrent requests for the last place, concurrent overlapping bookings, cancellation ownership, repeated cancellation and rebooking.

## Cloud setup

Copy `.env.example` to `.env.local` and enter the Firebase web app configuration. Keep `VITE_USE_EMULATORS=false` for production. The development override does not apply to `npm run build`.

A3 uses the `greenconnect` Functions codebase and a separate hosting target in the existing FIT5032 project. All A3 Firestore documents are under `greenconnect/v1`:

- `events/{eventId}` contains public event details and rating totals.
- `events/{eventId}/ratings/{uid}` contains the current account's private vote.
- `profiles/{uid}` contains the account's name, email, role and creation time.
- `registrations/{uid_eventId}` contains a member's booking and its current status.
- `schedules/{uid}` contains server-only reservations used to check time conflicts.

I update the event count, member schedule and booking in one Firestore transaction. Two requests for one activity share the event document. Two requests by one member share the schedule document. This lets Firestore detect competing changes before either request can overbook or create conflicting bookings. Cancellation updates the same documents and repeated cancellation does not release places twice.

The backend takes the user ID and email from the verified Firebase token. It does not accept a role or account identity from the form. Only a privileged Admin SDK operation can assign the `greenconnectAdmin` claim. Router guards control navigation, while Firestore rules and callable functions enforce access independently.

An operator with authorised Google Cloud credentials can grant the role to a chosen existing account:

```sh
node scripts/set-admin.js fit5032-66c61 <approved-user-uid>
```

The account must log out and log in again afterwards. No production admin password is included in this repository.

The Firestore rule outside the `greenconnect` collection preserves the project's earlier coursework rule and its original 18 October 2026 expiry. That compatibility rule does not grant access to GreenConnect. It is separate from the A3 access rules.

To create missing demonstration event documents without overwriting existing events:

```sh
node scripts/seed-cloud-events.js fit5032-66c61
```

Build before deploying:

```sh
npm run build
npm run deploy
```

The Firebase web configuration identifies the app. Mail-provider secrets and service-account private keys must never be placed in the frontend or committed.

## Tables and exports

The public event directory is at `/events`. The registration table is at `/records` and still needs an admin account. Both tables have a global search, individual column searches, sorting and fixed 10-row pagination. Searching ignores letter case and accents. Numeric columns sort as numbers.

Exports include every matching row, across all pages. PDF exports include the filter and sort summary, repeated table headings, page numbers and Melbourne export time. CSV uses UTF-8 with a byte-order mark for spreadsheet applications, quotes values and protects text cells starting with spreadsheet formula prefixes.

The admin page has an optional fictional demonstration dataset so I can show pagination without creating fake bookings in Firestore. It is labelled in the table and PDF title, and its CSV filename includes `registration-examples`. These examples use reserved `example.test` addresses and do not affect event capacity or participation statistics.

PDF export loads its library and font only when needed. The font is Noto Sans SC, distributed under the SIL Open Font License. The licence is in `public/licenses/NotoSansSC-LICENSE.txt`; the original font comes from https://github.com/notofonts/noto-cjk/tree/main/Sans/Variable/TTF/Subset. Unsupported symbols are shown as `?` with a notice in the PDF and on screen; CSV retains the original text.

The bundled export font is a static weight-400 instance of Noto Sans SC, made with FontTools.

## Booking emails

I use the Resend email API from a callable Cloud Function. A member can request a confirmation from My bookings after verifying their Firebase account email. The server checks the current Auth account and reads the member's confirmed booking. It does not use a recipient, attachment or booking details supplied by the browser.

The PDF contains the booking reference, activity, name, account email, Melbourne times, location and number of participants. The backend has a separate copy of the licensed Noto Sans SC font because Firebase deploys only the functions folder.

Before the email function can be deployed, an operator must configure the provider:

1. Create a Resend API key. For general use, verify a sending domain in Resend and choose an address from that domain. The `onboarding@resend.dev` sender only allows tests to the Resend account owner's email.
2. Store the key through the interactive secret prompt. Do not put the key in a frontend variable or paste it into a command that will be saved in shell history:

   ```sh
   npx firebase functions:secrets:set GREENCONNECT_RESEND_API_KEY --project fit5032-66c61
   ```

3. Copy `functions/.env.example` to `functions/.env.fit5032-66c61` and set `GREENCONNECT_EMAIL_FROM` to the approved sender. The real configuration file is ignored by Git.
4. Run the build and deployment commands above, then use a verified account with a confirmed booking to request an email. Check the receiving inbox and open the PDF before recording a successful delivery.

The email controls are enabled locally with emulators. They stay hidden in production until `VITE_BOOKING_EMAIL_ENABLED=true` is set and the frontend is rebuilt after provider setup. This lets the other features be reviewed while live email is still pending.

Requests share a private Firestore mail record for each booking confirmation and recipient. Concurrent requests use a short lease. The provider receives the same idempotency key and stored payload after a network error. Accepted requests return their existing result. Unconfirmed requests stop retrying after 23 hours, before Resend's 24-hour idempotency window ends. A member can attempt one new submission per minute and five per UTC day. Rebooking after cancellation creates a new confirmation version.

The private `mail` and `mailLimits` collections cannot be read or changed by browser clients, including admins. The page says the email service accepted a message when the API succeeds; this does not prove that it reached the inbox. Provider setup and an actual inbox check are required for the live email feature.

Local email integration tests use a mock transport with real emulator Auth and Firestore. They check ownership, verified email, cancelled bookings, concurrent sends, duplicate requests, caller-supplied recipients, throttling and safe retries. These tests do not send real emails.

Provider documentation: [Send email](https://resend.com/docs/api-reference/emails/send-email), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [test sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## Map and public API

The map is at `/map`. Search for a suburb or public landmark, select the starting point, then filter activities by radius, category or text. The list shows straight-line distances. Select an activity and request a driving route to see road distance, estimated duration and the route line. Activities at the same location share a marker with an activity chooser. The text list and route summary can be used without interacting with the map.

Manual search uses Photon by komoot. Driving routes use OSRM / FOSSGIS. The backend limits new requests to each provider across all function instances, caches place results for a day and validates coordinates. Only greater Melbourne is supported in this version. Both services are public demonstration services, so I show failures and do not assume they will always be available. Tile attribution stays visible, and the page has a link to fix OpenStreetMap data.

Four earlier demonstration records had the same placeholder coordinates even though they named different locations. `scripts/fix-demo-locations.js <project-id>` updates only those matching demo records to the coordinates already used for the same location. It preserves all bookings and capacity.

The two public REST routes are `GET /api/events` and `GET /api/events/:id`. Request examples, response fields, filters, map service routes and limits are in [PUBLIC_API.md](PUBLIC_API.md). Private `placeCache` and `mapServiceLimits` documents are accessible only to the backend.

## Admin dashboard and charts

The dashboard is at `/dashboard`. A router guard controls navigation, and `greenconnectAdminDashboard` checks the signed admin claim and the current Auth account before reading data. This also rejects a previously issued admin token after the account's role has been removed.

I count Auth accounts linked to a GreenConnect profile, because this Firebase project is shared with other coursework. Current Auth claims determine the admin/member counts. Disabled accounts stay in their role totals, and profiles with no matching Auth account are reported separately. Account IDs, names, email addresses and passwords are not returned by the dashboard function.

A read-only Firestore transaction reads profiles, events and registrations at the same database snapshot. The function returns selected event fields and booking status, participant count and date fields. The snapshot is refreshed when the page opens or the admin selects Refresh dashboard. It does not subscribe to changes in real time. The Auth role lookup happens separately from the Firestore transaction.

Overall totals show accounts, upcoming activities, confirmed bookings, reserved participant places and remaining upcoming capacity. The upcoming activity table shows occupancy and links back to each calendar activity. A warning appears if the event booked-place counters disagree with confirmed participant totals.

The chart section has separate creation-date and category filters. One chart groups the current booking records by their original creation date in Melbourne time. Its buttons show or hide confirmed, cancelled and interest-only lines. The other chart groups currently confirmed bookings by activity or category and switches between booking count and participant places. Tooltips show individual chart values, and HTML tables provide the same numbers without requiring canvas interaction.

These are views of the current records, not a complete history of booking actions. Rebooking updates the existing record. Cancelled records do not reserve places, and a group booking counts once as a booking but can reserve several participant places. The optional fictional records on the Records page are not read by this function. Empty results show zero values, rather than inserting example bookings into the charts.

The analysis accepts at most 366 days at a time. The function also limits a snapshot to 2,000 profiles, 500 events and 5,000 registrations. A larger app would need paged or precomputed summaries. The participation chart draws up to 12 groups; its table contains all groups.

Tests cover member and revoked-admin denial, current Auth role counts, exclusion of unrelated accounts and personal fields, Melbourne date grouping, combined filters, empty results and a real emulator booking/cancellation changing the capacity and summary together. Production administrator access still needs review through an existing authorised account.

Chart library documentation: [Chart.js interactions](https://www.chartjs.org/docs/latest/configuration/interactions.html), [chart lifecycle](https://www.chartjs.org/docs/latest/developers/api.html), and [Firebase Admin user lookup](https://firebase.google.com/docs/auth/admin/manage-users).
