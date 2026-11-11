import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests for the portal's own pure helpers (the *.test.ts files under src): URL filters,
// request bodies, error mapping, token handling. The workspace packages run their own tests
// (pnpm --filter "./packages/*" test); components and pages are covered by the browser tests
// in e2e/.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
