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

Auth is complete and wired. The map, site detail and report flow run on live
county data from `/api/sites` and `/api/reports`.

| Flow | Screen | Endpoint |
| --- | --- | --- |
| Sign in | Phone | `POST /api/auth/login` |
| Onboarding | Selfie | `POST /api/onboarding`, then `/:id/documents` |
| | ID photo | `POST /api/onboarding/:id/documents` |
| | Details | `POST /api/onboarding/:id/phone` |
| Session | restore on load | `GET /api/auth/me` |

There is no verification code. A phone number is the whole credential: sign-in
returns a token straight away, and the onboarding details step both finishes
sign-up and signs the user in.

A `404` on sign-in means no account, and routes into onboarding.

The details step asks for first name, last name and email. The API treats them
as optional, but 311 refuses a ticket without them, and that refusal would
otherwise surface at the user's first report rather than at sign-up.

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

One screen. The map fills it, and a draggable sheet floats over it with three
snap points: peek, half and nearly full. There is no bottom nav bar; the map is
the page.

The sheet's handle is a 44px strip with a 4px bar drawn inside it, because the
target is what the thumb has to find, not what the eye sees. A flick beats
position on release, so a quick swipe behaves the way it does elsewhere on a
phone.

Category filter pills sit across the top of the map, built from the registry.
Pills multi-select; none selected reads as All. The row renders whenever the
server reports a category, so enabling a second one needs no release here.
Filtering drives the pins, the heat layer and the list together.

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

## Careful: onboarding creates real accounts

Nothing sends an SMS any more; OTP was removed from the backend on 2026-11-08.
`POST /api/auth/login` with an unknown number is harmless, it just 404s.

`POST /api/onboarding/:id/phone` is the one to watch: it creates an account on
the spot, so driving it with an invented number leaves junk in the users
collection.

Note that login takes a phone number and returns a working token with no
verification step, so anyone who knows a number can sign in as its owner.

## Deploying

`VITE_API_URL` is read at **build** time, not run time, so it must be set
before the bundle is built and a rebuild is needed after changing it.

It must be written as `import.meta.env.VITE_API_URL`. Vite inlines only that
exact shape; `import.meta?.env?.VITE_API_URL` compiles to a runtime lookup,
and a production bundle's `import.meta.env` carries no custom `VITE_*` keys,
so it silently falls back to localhost once deployed.

To check a build before shipping it:

```sh
grep -o 'localhost:4000' dist/assets/*.js | wc -l   # expect 0 in a deploy build
```

Set `CORS_ORIGINS` on the backend to the deployed frontend origin. Unset means
all origins, which works until a request carries credentials.

## Note

Versions are pinned: this machine runs Node 20.14 and Vite 7+ needs 20.19+.
Upgrade Node before bumping Vite or TypeScript.
