import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The disposable database the browser tests use, never the dev one. */
export const E2E_DB = "crew-stars-e2e";

/** The operator the tests sign in to: its portal is {slug}.localhost (P7, playwright.config.ts). */
export const E2E_TENANT = process.env.CREWSTARS_TENANT ?? "e2e";

/** An owner the seed script creates (bonus-backend app/scripts/seed.py), and the password it
 *  is given here. Test-only: the e2e database is thrown away. */
export const E2E_OWNER = {
  email: "grant@example.com",
  password: process.env.E2E_OWNER_PASSWORD ?? "Crew-Stars-e2e-2026",
  name: "Grant",
};

/** Where the API lives: a bonus-backend checkout beside this one, unless told otherwise. */
export function backendPath(): string {
  return process.env.CREWSTARS_BACKEND ?? resolve(__dirname, "../../bonus-backend");
}

/** The MongoDB the API will use: CS_MONGODB_URI from the environment, else from the API
 *  checkout's .env (what the API itself would read), else null. */
function apiMongoUri(backend: string): string | null {
  if (process.env.CS_MONGODB_URI) return process.env.CS_MONGODB_URI;
  const envFile = resolve(backend, ".env");
  if (!existsSync(envFile)) return null;
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((text) => text.trim().startsWith("CS_MONGODB_URI="));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : null;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Refuses to start when the API would write the e2e database to a MongoDB that is not on this
 * machine. Each run creates a database of its own collections, and on a shared cluster (Atlas)
 * those count against the cluster's collection cap, which every other database on it shares.
 * CI runs its own local replica set. E2E_ALLOW_REMOTE_DB=1 overrides, for a cluster that is
 * yours alone. Called when playwright.config.ts loads, before any server is started.
 */
export function assertLocalDatabase(): void {
  if (process.env.E2E_ALLOW_REMOTE_DB === "1") return;
  const uri = apiMongoUri(backendPath());
  if (uri === null) return;
  let host: string | null = null;
  try {
    host = new URL(uri).hostname;
  } catch {
    // A list of hosts (a replica set by hand) is not something to guess about.
  }
  if (host !== null && LOCAL_HOSTS.has(host)) return;
  throw new Error(
    `the browser tests write a database on the API's MongoDB, which is not local (${host ?? "unreadable URI"}).\n` +
      "Run a local MongoDB replica set and set CS_MONGODB_URI to it, or set E2E_ALLOW_REMOTE_DB=1 for a cluster that is yours alone.",
  );
}

/**
 * Checks the API checkout is there, then seeds the e2e operator with the prototype's areas,
 * stores, people and owners (safe to run again: anything already there is left alone). The
 * owners get E2E_OWNER's password the first time they are created.
 */
export default function globalSetup(): void {
  const backend = backendPath();
  if (!existsSync(resolve(backend, "app/main.py"))) {
    throw new Error(
      `the browser tests need the API: no checkout at ${backend}.\n` +
        "Clone bonus-backend beside this repository, or set CREWSTARS_BACKEND to where it is.",
    );
  }
  execFileSync(
    "python",
    [
      "-m",
      "uv",
      "run",
      "python",
      "-m",
      "app.scripts.seed",
      "--slug",
      E2E_TENANT,
      "--name",
      "E2E Restaurants",
      "--password",
      E2E_OWNER.password,
    ],
    {
      cwd: backend,
      // The same switches the API is started with (playwright.config.ts).
      env: { ...process.env, CS_MONGODB_DB: E2E_DB, CS_ENV: "dev" },
      stdio: "inherit",
    },
  );
}
