# Crew Stars - owner portal and back office

The web portal where the owners run Crew Stars: recognition across the stores, redemptions,
and the rules (rewards, coins and limits, spins, badges and tiers, monthly awards), plus the
roster and the audit log. The same app is Crew Stars' own back office (operators, their
owners, health, the back office's audit log and staff) and the "Find your company" page.
Next.js 16, deployed on Vercel. Crew and GMs use the mobile app (`bonus-app`); everything is
served by the API (`bonus-backend`).

| Repository | What |
|---|---|
| `bonus-backend` | the API, rules engine, jobs and deployment |
| `bonus-admin` (this one) | this portal, plus the `packages/*` it shares with the app |
| `bonus-app` | the mobile app for crew and GMs |

## Layout

```
src/app/(operator)/            every page on an operator's host; the layout checks the operator
  (portal)/                    the owner portal's pages, inside the sidebar layout
  login/ invite/ reset/ forgot/   owner sign-in, the emailed invite and reset links, "Forgot password?"
src/app/platform/              the back office (admin.<base>)
  login/ invite/               staff sign-in (always with an authenticator) and a colleague's invite
  (console)/                   overview, operators (+ new, + one), health, audit, staff
src/app/site/                  "Find your company" (the bare domain)
src/app/api/[...path]/         the BFF: proxies to the API, keeps tokens in httpOnly cookies
src/app/api/session/           refresh (renew, then carry on) and end (drop the cookies)
src/proxy.ts                   host routing, and no session cookie -> /login
src/lib/host.ts                which surface a host is for
packages/api-client            typed client generated from the API's OpenAPI schema
packages/shared                design tokens (-> src/app/tokens.css) and contrast helpers
packages/i18n                  English and Spanish UI strings
```

## Hosts (P7)

One app answers three kinds of host under one base domain (`CREWSTARS_BASE_DOMAIN`,
`stars.genifem.com` deployed, `localhost` locally):

| Host | What | Served from |
|---|---|---|
| `{slug}.<base>` | that operator's owner portal | the app's root pages |
| `admin.<base>` | the back office | `src/app/platform` |
| `<base>` | "Find your company" | `src/app/site` |
| anything else | 404 | |

`src/proxy.ts` decides from the request's Host header (`src/lib/host.ts`); a surface's pages
are a 404 on another surface's host. The operator is the host's first label: the BFF and the
Server Components send it upstream as `X-Tenant` (`src/lib/upstream.ts`), and never forward a
browser's own `X-Tenant` or `Authorization`. The back office and the bare domain send no
`X-Tenant`, and the BFF lets each host reach only its own endpoints (`/platform` and
`/auth/platform` on `admin.`, `/public` on the bare domain, everything else on an operator's
host). An operator nobody has created, or one the back office has suspended, gets a page that
says so (`src/app/(operator)/layout.tsx`, from `GET /meta`).

Sessions live in host-only, httpOnly cookies (`src/lib/session.ts`): each operator's portal
keeps its own owner session (`cs_access`, `cs_refresh`) and the back office its own
(`cs_bo_access`, `cs_bo_refresh`). Both are capped at 12 hours (NF-04); the back office also
signs out after 20 minutes without use (401 `session_idle` from the API, and the page's own
timer, `src/components/backoffice/IdleSignOut.tsx`). Every back office write asks for a reason,
which the API keeps in its audit log.

Locally: `http://demo.localhost:3000`, `http://admin.localhost:3000`, `http://localhost:3000`
(browsers send `*.localhost` to this machine). The API's `CS_BASE_DOMAIN` must match, and its
`CS_PORTAL_URL` gives the links in its emails their scheme and port.

## Environment

Copy `.env.example` to `.env.local`. All three are server-side only (never `NEXT_PUBLIC_`).

| Variable | What |
|---|---|
| `API_INTERNAL_URL` | where the server reaches the API (`http://127.0.0.1:8000` locally) |
| `API_PROXY_SECRET` | equals the API's `CS_PROXY_SECRET` when the API sits behind Caddy (Vercel); empty locally |
| `CREWSTARS_BASE_DOMAIN` | the base domain above (`stars.genifem.com`; `localhost` when unset). Equals the API's `CS_BASE_DOMAIN` |

`CREWSTARS_TENANT` is gone: the host names the operator now.

## Scripts

```bash
pnpm install
pnpm dev          # http://demo.localhost:3000, http://admin.localhost:3000, http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm tokens       # regenerate src/app/tokens.css after editing packages/shared/src/tokens.ts
pnpm check:messages   # every translation key the code uses exists in en.json
pnpm gen:api      # regenerate the API client from ../bonus-backend (or CREWSTARS_BACKEND)
pnpm e2e          # Playwright: seeds and starts the API (db crew-stars-e2e) and the portal on e2e.localhost:3100
```

A back office account for local development comes from the API checkout:
`python -m app.scripts.create_platform_admin --email ... --name ... --password ...` (the
password option is for local development only; without it the admin is emailed an invite).

`pnpm test` checks that `tokens.css` is current, that every message key exists, and runs the
unit tests: the portal's own helpers (`src/**/*.test.ts`: host routing, URL filters, request
bodies, error mapping, token handling) and the packages' (token contrast, catalog parity
between `en` and `es`).

`pnpm e2e` needs a MongoDB replica set on this machine (`CS_MONGODB_URI` pointing at
localhost): it creates and seeds the `crew-stars-e2e` database, and it refuses to start when
the API's MongoDB is remote, because on a shared cluster those collections count against the
cluster's cap. `E2E_ALLOW_REMOTE_DB=1` overrides, for a cluster that is yours alone.
`CREWSTARS_TENANT` there only names the seeded operator (`e2e` by default).

`pnpm gen:api` runs `python -m uv run python -m app.scripts.export_openapi` inside
`../bonus-backend`; without that checkout it regenerates from the committed `openapi.json`.
CI fails if the committed client differs.

## Deploying (Vercel)

- Import the repository as a Next.js project; the Git integration deploys `main` to production
  and every pull request to a preview. No Docker image, no `output: "standalone"`.
- Install command `pnpm install --frozen-lockfile`, build command `pnpm build` (the defaults).
- Set `API_INTERNAL_URL` (the public API address, e.g. `https://api.stars.genifem.com`),
  `API_PROXY_SECRET` and `CREWSTARS_BASE_DOMAIN=stars.genifem.com` for Production. Never as
  `NEXT_PUBLIC_*`. Remove `CREWSTARS_TENANT`.
- Domains in the project: `stars.genifem.com` ("Find your company"), `admin.stars.genifem.com`
  (the back office), and one per operator, `{slug}.stars.genifem.com` (below). No wildcard.
  A preview deployment's own `*.vercel.app` address is none of these, so it answers 404.
- Node.js 22.x in the project settings (`engines` asks for 22 or later).
- The repository is in the `genifem` GitHub organisation: Vercel's GitHub app needs access to
  it ("Add GitHub Scope" when importing), and a private organisation repository may need a
  Pro team rather than a Hobby one.
- The live API is `https://api.stars.genifem.com` (Lightsail, since 2026-11-12). Its first
  operator is the test operator `demo`, at `https://demo.stars.genifem.com`. The API needs
  `CS_BASE_DOMAIN=stars.genifem.com` and `CS_PORTAL_URL=https://stars.genifem.com`.
- DNS for genifem.com is at Hostinger: `api.stars` is an A record to the API server; `stars`,
  `admin.stars` and each operator's `{slug}.stars` are the records Vercel shows for them.

### A new operator's address

Creating an operator in the back office (Operators -> New operator) makes it in the API and
emails its first owner an invite to `https://{slug}.stars.genifem.com/invite#token=...`. That
address works once it is online, which is two steps by hand (the operator's page lists them,
with the names filled in):

1. At Hostinger, in the DNS zone for `genifem.com`: add a CNAME record named `{slug}.stars`,
   pointing at the target Vercel shows for the domain (usually `cname.vercel-dns.com`).
2. In Vercel, the portal's project, Settings -> Domains: add `{slug}.stars.genifem.com`, and
   wait until it shows as valid.

The invite works for 7 days; Resend invite on the operator's page sends a new one.
