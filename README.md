# Community Loop

Mobile-first web app. Phone widths; centres at 430px on desktop.

## Run

```bash
npm install
npm run dev
```

Needs the backend running on `:4000` (`cd ../hackathon_ai_backend && npm run dev`).

## Backend

`src/lib/api-client.js` is copied **verbatim** from
`hackathon_ai_backend/examples/api-client.js`. Re-copy it when the backend
changes; don't hand-edit it. `src/lib/api-client.d.ts` carries the types and
has to be kept in step.

`.env` holds `VITE_API_URL=http://localhost:4000`.

## Status

Auth is complete and wired. The home page is built but runs on fixtures.

| Flow | Screen | Endpoint |
| --- | --- | --- |
| Sign in | Phone | `POST /api/auth/otp/request` |
| | Code | `POST /api/auth/otp/verify` |
| Onboarding | Selfie | `POST /api/onboarding`, then `/:id/documents` |
| | ID photo | `POST /api/onboarding/:id/documents` |
| | Phone | `POST /api/onboarding/:id/phone` |
| | Code | `POST /api/onboarding/:id/verify` |
| Session | restore on load | `GET /api/auth/me` |

A `404` on sign-in means no account, and routes into onboarding. That is the
single-entry-field approach from the backend's FRONTEND.md.

## Service area

Miami-Dade County only. `src/lib/geo.ts` holds the bounding box, the map
cannot be panned outside it (`maxBounds` with full viscosity), and
`isInsideServiceArea()` is the single check for whether a coordinate counts.

`useUserLocation()` watches the device position. Inside the county it draws a
blue dot with an accuracy halo and sorts the list nearest-first; outside, the
UI says so and falls back to the county view. Geolocation needs a secure
context, exactly like the camera, so over plain HTTP on a LAN address it
reports unavailable and the map stays on Miami-Dade.

## Home page

Two tabs: **Home** (default) and **Community**.

Home is a 60% map over a sheet, with category filter pills across the top.
Pills multi-select; none selected reads as All. Filtering drives the pins, the
heat layer and the list together.

**Pins** are the reporter's photo in a ring with the category badged on it: the
photo says what happened, the badge says what kind of thing it is. Pins that
would overlap on screen merge into a counted cluster (72px grid, reprojected on
every pan and zoom); tapping a cluster flies in two levels rather than guessing
which report was meant. A selected report always breaks out of its cluster.

**Heat** stays on underneath at every zoom but drops to 0.14 opacity past zoom
15, so close up it is background context rather than noise. The legend is
permanent, because colour without a scale communicates nothing.

Leaflet with OpenStreetMap tiles (no API key). The basemap is pushed close to
greyscale by a CSS filter on `.leaflet-tile-pane`, so the data carries the
colour.

Community ranks neighbourhoods by report volume and lists the latest filings.

### Photos

Every report carries `photos: string[]`. They appear on the pin, in the list
row, and full width at the top of the detail view, because the photo is the
evidence.

**Fixtures point at picsum.photos**, so the demo needs a network connection and
the imagery is obviously generic. Swap `photos` for the backend's presigned
`downloadUrl` when the reports API lands.

### Data

**The backend has no reports API.** `src/lib/reports.ts` generates 112 fixtures
from a table of neighbourhood volumes, seeded so the demo is stable across
reloads. When the endpoint lands, replace the bodies of `listReports()` and
`getReport()` and delete the generator.

There is deliberately **no status or lifecycle field** anywhere in the report
data or UI, because the loop's real stages have not been specified.

## Camera needs HTTPS

Onboarding captures photos with `getUserMedia`, which browsers only allow in a
**secure context**. That means `localhost` works over plain HTTP, but testing on
a phone over the LAN (`http://192.168.x.x:5173`) does **not**. The camera
silently falls back to the OS picker.

```bash
npm run dev:https     # self-signed cert; accept the browser warning
```

If the camera hasn't started within 6 seconds the UI falls back to the file
picker on its own, so a hanging permission prompt never traps anyone.

## Careful: SMS is live

The backend has Infobip configured, so `smsSimulated` is `false` and **every
phone step sends a real text to a real number**. `devCode` is only returned by
the local provider, so it will never appear in this setup. Test with your own
number, not an invented one.

## Note

Versions are pinned: this machine runs Node 20.14 and Vite 7+ needs 20.19+.
Upgrade Node before bumping Vite or TypeScript.
