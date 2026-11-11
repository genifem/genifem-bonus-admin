import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** The disposable database the browser tests use, never the dev one. */
export const E2E_DB = "crew-stars-e2e";

/** Where the API lives: a bonus-backend checkout beside this one, unless told otherwise. */
export function backendPath(): string {
  return process.env.CREWSTARS_BACKEND ?? resolve(__dirname, "../../bonus-backend");
}

/**
 * Checks the API checkout is there before Playwright tries to start it. Seeding the e2e
 * database (the prototype's stores and people, plan §2) is added here once bonus-backend has
 * its seed script (P1); the P0 smoke test needs no data.
 */
export default function globalSetup(): void {
  const backend = backendPath();
  if (!existsSync(resolve(backend, "app/main.py"))) {
    throw new Error(
      `the browser tests need the API: no checkout at ${backend}.\n` +
        "Clone bonus-backend beside this repository, or set CREWSTARS_BACKEND to where it is.",
    );
  }
}
