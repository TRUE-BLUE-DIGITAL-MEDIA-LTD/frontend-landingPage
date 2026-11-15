# Oxyclick landing page

The Next.js app (pages router) that renders every published lander. One build is deployed to each partner domain's Netlify site; the site picks its content by reading the lander document the dashboard publishes to that site's Netlify Blobs store.

This app is **render-only**. It has no API routes, no database connection and no secrets. Everything a visitor's browser needs to write — leads, analytics, merchant signups — goes to the central [lander-api](https://github.com/TRUE-BLUE-DIGITAL-MEDIA-LTD/lander-api) service.

## How a page is served

1. `getServerSideProps` in `pages/index.tsx` reads the lander blob for the site (`services/landerBlob.ts`) and picks a lander by route, language and A/B weight (`services/pick-lander.ts`).
2. The lander's HTML is prepared on the server (`server/render/`): dev/prod runtime scripts are reconciled, translations are substituted, and multi-step forms are stamped with the lander id, fallback link, API origin and visitor country.
3. The page is sent to the browser, where `pages/index.tsx` wires links, forms, the quiz, the signup block and analytics.

The visitor's country comes from Netlify's `x-nf-geo` header (`server/geo.ts`). Because lander-api cannot see that header, the page receives the ISO country code as a prop and passes it along on every API call.

## Talking to lander-api

`services/lander-api.ts` is the single place that knows about the API:

| Export | Purpose |
|---|---|
| `LANDER_API_ORIGIN` | `https://lander-api.oxyclick.com` — a constant, not an env var, so nothing has to be configured on each Netlify site |
| `landerApiUrl(path)` | Absolute API URL; a lander on `localhost` talks to `http://localhost:3001` |
| `postLanderApi(path, body)` | JSON POST with a 5-second timeout; rejects on any non-2xx answer or network failure |
| `setLanderCountryCode` / `getLanderCountryCode` | The Netlify-resolved country code, sent with every call |
| `resolveVisitor()` | Per-domain visitor id for returning-visitor analytics, kept in `localStorage` |

| Caller | API route |
|---|---|
| `services/email.ts` — `CreateEmailService` | `POST /v1/customers` |
| `services/email.ts` — `ValidateEmail` | `POST /v1/customers/validate` |
| `services/tracking.ts` — `createLanderSession` | `POST /v1/view` |
| `services/tracking.ts` — `initLanderTracking` | `POST /v1/track` |
| `services/signup-form.ts` — `initSignupForms` | `POST /v1/profile/create` |
| Multi-step form runtime (served by the dashboard) | `POST /v1/customers`, via the `data-oxy-api` stamp |

Every form treats an API failure as non-fatal: the visitor is still redirected to the offer.

## Local development

The lander has no database access, so local development needs a locally running lander-api to supply content:

```bash
# 1. In servers/lander-api
DATABASE_URL="mongodb+srv://…/development-oxyclick" \
PORT=3001 DEV_ORIGINS="http://localhost:8181" DEV_LANDER_BLOB=1 \
bun run dev

# 2. In this folder
npm install
npm run dev          # http://localhost:8181
```

With `NEXT_PUBLIC_NODE_ENV=development`, the lander asks `http://localhost:3001/dev/lander-blob?host=localhost:8181` for its content, so the dev database needs a domain named `localhost:8181`.

To render a real site's published content instead, set `NETLIFY_SITE_ID` and `NETLIFY_BLOBS_TOKEN`; the lander then reads that site's blob store directly.

## Scripts

```bash
npm run dev      # development server on port 8181
npm run build    # production build
npm run start    # serve the production build on port 8181
npm run lint     # eslint
npm test         # unit tests (vitest)
```

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_NODE_ENV` | local | `development` switches the lander to local content and `localhost:8181` as host |
| `NETLIFY_SITE_ID`, `NETLIFY_BLOBS_TOKEN` | local, optional | Read a real site's published blob instead of the local lander-api |

On Netlify the blob store context is injected by the platform; no variable is required.

## Project layout

```
pages/
  index.tsx          the lander page: server-side render + browser wiring
  sitemap.xml.tsx    per-domain sitemap
server/
  geo.ts             visitor country from Netlify's geo header
  render/            server-side HTML preparation (i18n, form stamping, script parity)
services/
  lander-api.ts      central API client (origin, POST helper, country, visitor id)
  landerBlob.ts      reads the published lander document; picks the lander
  pick-lander.ts     route / language / A-B selection
  email.ts           lead save and email validation
  tracking.ts        analytics session and events
  signup-form.ts     browser wiring for the editor's Dating Signup block
  merchant.ts        legacy direct-link registration
  main-cta.ts, main-target.ts, new-tab.ts   link handling helpers
interfaces/          shared types
```

## What changed: the move to lander-api

Before this change every Netlify site ran its own API routes, opened its own MongoDB connection through Prisma and carried its own copy of the secrets. With 500+ sites that meant 500+ places to configure and 500+ sets of database connections.

**Removed from this app**

- `pages/api/` — `track`, `view`, `v1/customers`, `v1/customers/validate`
- `prisma/schema.prisma`, `@prisma/client`, and the `prisma generate` build step (the build script is now plain `next build`)
- `server/analytics/` and `server/customers/` — the logic moved to lander-api
- `services/landingPage.ts` — the Prisma-based lander lookup used in local development
- Dependencies: `@prisma/client`, `prisma`, `axios`, `neverbounce`, `request-ip`

**Added**

- `services/lander-api.ts` — the API client described above
- `services/signup-form.ts` — the Dating Signup block: validates the form, posts to lander-api, sends the visitor to the merchant's login URL, and falls back to the main offer link when the signup cannot succeed
- `countryCodeFromNetlifyHeader` in `server/geo.ts`
- `ResponseGetLandingPageService` moved into `interfaces/`

**Changed behaviour**

- **Returning-visitor id.** It used to be an HttpOnly cookie set by the lander's own `/api/view`. An API on another domain cannot set a first-party cookie, so the id now lives in `localStorage`. The old cookie's value is handed to the page once so existing visitors keep counting as returning.
- **Analytics beacons** are sent as `text/plain` JSON, which avoids a CORS preflight on every event.
- **Regular email form.** A failed lead save no longer blocks the redirect: the visitor still reaches the offer with `sub3` set. API calls time out after 5 seconds (8 for email validation).
- **Views are counted only on the lander's own domain.** A page opened under another hostname (the site's `*.netlify.app` name, a translation proxy) no longer records a view.
- **Direct-link registration** (`services/merchant.ts`) no longer calls `api.ipify.org` first, and gives up after 10 seconds.
- **Local development** needs a local lander-api, as described above.

**Deploying this change**

Deploy in this order: **lander-api → dashboard → landers.** The dashboard serves the multi-step form script; a lander deployed before the new script is live sends multi-step leads to a route that no longer exists (the visitor is still redirected).

After the rollout is settled, `DATABASE_URL` and `NEVERBOUNCE_API_KEY` are no longer used by the Netlify sites and can be removed from them. Keep them until then: rolling a site back to its previous build needs them.
