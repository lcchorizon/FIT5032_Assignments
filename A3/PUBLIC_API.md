# GreenConnect public event API

Base URL: `https://greenconnect-a3-66c61.web.app`

I use two public read routes for event information. They do not require an account. Profiles, individual ratings, bookings, email addresses and user IDs are not included.

## List events

```http
GET /api/events
GET /api/events?category=Education&familyFriendly=true&available=true&limit=10
GET /api/events?q=Clayton&from=2026-11-01T00%3A00%3A00%2B11%3A00
```

Supported optional filters:

| Parameter | Meaning |
| --- | --- |
| `q` | Search title, description, location and category, ignoring case; up to 120 characters |
| `category` | Exact category name, such as `Education` |
| `familyFriendly` | `true` or `false` |
| `available` | `true` for activities with remaining places, or `false` for full activities |
| `from` | Inclusive earliest start time as an ISO date and time with a timezone |
| `limit` | Integer from 1 to 100; default 100 |

Filters combine. Events sort by start time, then event ID. The response has `events`, `matchingCount` and `returnedCount`. The limit applies after filtering. The current application has 12 demonstration activities. The server reads at most 501 event documents and returns a service error above 500; a larger directory would need cursor pagination.

## Get one event

```http
GET /api/events/1
```

The response has one `event` object. Public fields are `id`, `title`, `description`, `category`, `location`, `startAt`, `endAt`, `capacity`, `bookedPlaces`, `availablePlaces`, `familyFriendly`, `latitude`, `longitude` and `isDemo`.

`availablePlaces` is calculated from capacity and the current booked places. Event responses can be cached for 30 seconds. The booking function checks capacity again in its transaction. A public API response does not reserve a place.

## Errors and methods

Errors are JSON in this form:

```json
{ "error": { "message": "This event could not be found." } }
```

| Status | Meaning |
| --- | --- |
| 200 | Request succeeded |
| 204 | CORS preflight succeeded |
| 400 | Invalid event ID, unsupported filter or invalid parameter |
| 404 | Event or API route does not exist |
| 405 | Unsupported HTTP method; see the `Allow` response header |
| 429 | A map provider request would exceed the shared rate limit |
| 422 | Event has no usable map location, or no driving route was found |
| 503 | Provider unavailable or directory too large for this version |

Both event routes support `GET` and `OPTIONS`. CORS permits public access from other origins. These routes never provide private account data.

## Map service routes

The map page also uses `GET /api/places?q=...` and `POST /api/route`. These are separate from the two event read routes.

Place search accepts 3 to 120 characters and returns up to five Photon results in greater Melbourne. A result has `label`, `latitude` and `longitude`. I cache results for one day using a hash of the query as the document ID. Searches happen only after a form submission.

A route request has a JSON body:

```json
{ "latitude": -37.8183, "longitude": 144.9671, "eventId": "4" }
```

The server reads the destination coordinates from the event document. It returns `distanceMetres`, `durationSeconds`, GeoJSON `geometry`, the distances from each selected point to its nearest routable road, and the provider name. Route estimates are for driving and do not include live traffic, parking or walking to the activity. Coordinates must be numeric and within the greater Melbourne bounds used by this demonstration.

Each map provider has a shared Firestore rate gate of one new request per 1.2 seconds across function instances. Cached place searches do not call the provider. A busy gate returns 429 with `Retry-After: 2`; it does not queue a background request. Route responses and errors use `Cache-Control: no-store`. Origin coordinates are not written to the application's Firestore documents. The external routing service can keep request logs under its privacy policy.

The backend endpoints can be changed using `GREENCONNECT_PLACE_URL` and `GREENCONNECT_ROUTE_URL` in the functions environment. The defaults are Photon by komoot and the OSRM car service run by FOSSGIS. These public services are suitable for this small demonstration and do not guarantee availability. A larger application would need a provider agreement or its own service.

Map data comes from OpenStreetMap. The page keeps attribution visible and includes a link to report map problems. Search and route requests share location information with the named providers; the page explains this before the user requests them. Browser geolocation is optional, and manual place search remains available when permission is declined.

Documentation: [Leaflet](https://leafletjs.com/reference.html), [Photon API](https://github.com/komoot/photon), [OSRM routes](https://project-osrm.org/docs/v26.5.0/http), [FOSSGIS service policy](https://routing.openstreetmap.de/about.html), [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).
