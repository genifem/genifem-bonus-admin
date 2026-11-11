# Crew Stars - owner portal

The web portal where the owners run Crew Stars: recognition across the stores, redemptions,
and the rules (rewards, coins and limits, spins, badges and tiers, monthly awards), plus the
roster and the audit log. Next.js 16, deployed on Vercel. Crew and GMs use the mobile app
(`bonus-app`); everything is served by the API (`bonus-backend`).

| Repository | What |
|---|---|
| `bonus-backend` | the API, rules engine, jobs and deployment |
| `bonus-admin` (this one) | this portal, plus the `packages/*` it shares with the app |
| `bonus-app` | the mobile app for crew and GMs |

## Layout

```
src/app/login/              owner sign-in (email + password)
src/app/(portal)/           every portal page, inside the sidebar layout
src/app/api/[...path]/      the BFF: proxies to the API, keeps tokens in httpOnly cookies
src/app/api/session/        refresh (renew, then carry on) and end (drop the cookies)
src/proxy.ts                no session cookie -> /login
packages/api-client         typed client generated from the API's OpenAPI schema
packages/shared             design tokens (-> src/app/tokens.css) and contrast helpers
packages/i18n               English and Spanish UI strings
```

One operator, one domain (plan D3): there are no tenant subdomains. The BFF names the
operator on every upstream call as `X-Tenant` from `CREWSTARS_TENANT`, and never forwards a
browser's own `X-Tenant` or `Authorization`. Portal sessions are capped at 12 hours (NF-04).

## Environment

Copy `.env.example` to `.env.local`. All three are server-side only.

| Variable | What |
|---|---|
| `API_INTERNAL_URL` | where the server reaches the API (`http://127.0.0.1:8000` locally) |
| `API_PROXY_SECRET` | equals the API's `CS_PROXY_SECRET` when the API sits behind Caddy (Vercel); empty locally |
| `CREWSTARS_TENANT` | the operator slug sent as `X-Tenant` |

## Scripts

```bash
pnpm install
pnpm dev          # http://localhost:3000 (needs the API running next door)
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm tokens       # regenerate src/app/tokens.css after editing packages/shared/src/tokens.ts
pnpm check:messages   # every translation key the code uses exists in en.json
pnpm gen:api      # regenerate the API client from ../bonus-backend (or CREWSTARS_BACKEND)
pnpm e2e          # Playwright: starts the API (db crew-stars-e2e) and the portal on :3100
```

`pnpm test` checks that `tokens.css` is current, that every message key exists, and runs the
package tests (token contrast, catalog parity between `en` and `es`).

`pnpm gen:api` runs `python -m uv run python -m app.scripts.export_openapi` inside
`../bonus-backend`; without that checkout it regenerates from the committed `openapi.json`.
CI fails if the committed client differs.

## Deploying (Vercel)

- Import the repository as a Next.js project; the Git integration deploys `main` to production
  and every pull request to a preview. No Docker image, no `output: "standalone"`.
- Install command `pnpm install --frozen-lockfile`, build command `pnpm build` (the defaults).
- Set `API_INTERNAL_URL` (the public API address, e.g. `https://api.stars.genifem.com`),
  `API_PROXY_SECRET` and `CREWSTARS_TENANT` for Production and Preview. Never as
  `NEXT_PUBLIC_*`.
- Domain: the portal's own host (plan: `stars.genifem.com`). No wildcard domains.
