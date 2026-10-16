# GreenConnect A3

I am extending my A1.3 application for community environmental activities in Melbourne. The sample activities are demonstration data, rather than real advertised events.

## Current features

- Firebase Authentication accounts with registration, login, logout and session restoration
- Firestore profiles and member/admin access using a signed `greenconnectAdmin` claim
- Searchable event cards with category and family-friendly filters
- Event directory and admin registration tables with sorting, column filters and 10 rows per page
- CSV and PDF exports of all matching records in their current sort order
- Activity calendar with Melbourne dates and times
- Confirmed group bookings with server-side capacity, duplicate and overlap checks
- Cancellation before the event starts, with places released for other members
- Cloud Function validation for bookings and event ratings
- Personal registration records and an admin records page
- One rating per account for each event, with public rating totals
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
