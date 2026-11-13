import { defineConfig, devices } from "@playwright/test";

import { assertLocalDatabase, backendPath, E2E_DB, E2E_TENANT } from "./e2e/global-setup";

/**
 * Browser tests run against a disposable database (crew-stars-e2e), never the dev one, and
 * start both servers themselves - the API from the bonus-backend checkout beside this
 * repository. Each operator has its own host (P7, src/lib/host.ts): with the base domain
 * `localhost`, the seeded operator's portal is e2e.localhost, which Chromium sends to this
 * machine like localhost itself. Phone and desktop projects cover both layouts of the rail
 * (NF-01).
 */
// Before anything starts: the API below would otherwise create the e2e database wherever its
// .env points, a shared cluster included.
assertLocalDatabase();

const API_PORT = 8001;
const WEB_PORT = 3100;
const TENANT = E2E_TENANT;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://${TENANT}.localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Each project signs in from its own address. The web app passes X-Forwarded-For on
  // (lib/upstream.ts); deployed, the proxy in front replaces it, so this only works against a
  // local API.
  projects: [
    {
      name: "phone",
      use: { ...devices["Pixel 7"], extraHTTPHeaders: { "x-forwarded-for": "198.51.100.7" } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], extraHTTPHeaders: { "x-forwarded-for": "198.51.100.8" } },
    },
  ],
  webServer: [
    {
      command: `python -m uv run uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: backendPath(),
      url: `http://127.0.0.1:${API_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // The switches the suite is written for, pinned so a checkout's own .env cannot change
      // them: no texted codes and no owner second factor.
      env: {
        CS_MONGODB_DB: E2E_DB,
        CS_ENV: "dev",
        CS_SMS_ENABLED: "false",
        CS_OWNER_MFA_ENABLED: "false",
      },
    },
    {
      // E2E_PROD builds first and serves the built app: that is what CI runs, because a cold
      // dev server compiles routes as the tests click through them and a first click can land
      // before its route is ready. Without it, the dev server, which is quicker to start when
      // you are working on a test.
      command: process.env.E2E_PROD
        ? `pnpm build && pnpm start --port ${WEB_PORT}`
        : `pnpm dev --port ${WEB_PORT}`,
      // The bare domain ("Find your company"): Node may not resolve e2e.localhost on every OS.
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
        CREWSTARS_BASE_DOMAIN: "localhost",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
