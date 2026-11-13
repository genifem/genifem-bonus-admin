import { afterEach, describe, expect, it, vi } from "vitest";

import { baseDomain, hostName, parseHost, subdomainSetup } from "./host";
import { slugProblem, suggestSlug } from "./slug";
import { hostTenant, upstreamHeaders } from "./upstream";

const BASE = "stars.genifem.com";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseHost", () => {
  it("sends an operator's host to its portal", () => {
    expect(parseHost("acme.stars.genifem.com", BASE)).toEqual({ kind: "operator", slug: "acme" });
    expect(parseHost("Acme.Stars.Genifem.com:443", BASE)).toEqual({ kind: "operator", slug: "acme" });
    expect(parseHost("demo.localhost:3003", "localhost")).toEqual({ kind: "operator", slug: "demo" });
  });

  it("knows the back office and the bare domain", () => {
    expect(parseHost("admin.stars.genifem.com", BASE)).toEqual({ kind: "platform" });
    expect(parseHost("admin.localhost:3003", "localhost")).toEqual({ kind: "platform" });
    expect(parseHost("stars.genifem.com", BASE)).toEqual({ kind: "site" });
    expect(parseHost("localhost:3003", "localhost")).toEqual({ kind: "site" });
  });

  it("refuses every other host", () => {
    for (const host of [
      null,
      "",
      "genifem.com",
      "evil.com",
      "acme.stars.genifem.com.evil.com",
      "a.b.stars.genifem.com",
      "-acme.stars.genifem.com",
      "acme-.stars.genifem.com",
      "acme_x.stars.genifem.com",
      // Reserved slugs are ours, never an operator's.
      "www.stars.genifem.com",
      "api.stars.genifem.com",
      "[::1]:3003",
      "127.0.0.1:3003",
    ]) {
      expect(parseHost(host, BASE), String(host)).toEqual({ kind: "unknown" });
    }
  });

  it("takes the first of a list and drops a trailing dot", () => {
    expect(hostName("acme.stars.genifem.com., other.example")).toBe("acme.stars.genifem.com");
  });

  it("reads the base domain from CREWSTARS_BASE_DOMAIN, localhost without it", () => {
    vi.stubEnv("CREWSTARS_BASE_DOMAIN", " Stars.Genifem.com. ");
    expect(baseDomain()).toBe("stars.genifem.com");
    vi.stubEnv("CREWSTARS_BASE_DOMAIN", "https://stars.genifem.com");
    expect(baseDomain()).toBe("localhost");
    vi.stubEnv("CREWSTARS_BASE_DOMAIN", "");
    expect(baseDomain()).toBe("localhost");
  });
});

describe("upstreamHeaders", () => {
  it("names the operator from the host, and only on an operator's host", () => {
    vi.stubEnv("CREWSTARS_BASE_DOMAIN", BASE);
    vi.stubEnv("API_PROXY_SECRET", "");
    expect(upstreamHeaders("acme.stars.genifem.com", "203.0.113.9")).toEqual({
      "x-tenant": "acme",
      "x-forwarded-host": "acme.stars.genifem.com",
      "x-forwarded-for": "203.0.113.9",
    });
    expect(upstreamHeaders("admin.stars.genifem.com", null)).not.toHaveProperty("x-tenant");
    expect(upstreamHeaders("stars.genifem.com", null)).not.toHaveProperty("x-tenant");
    expect(hostTenant("elsewhere.example")).toBeNull();
  });

  it("vouches for the host and IP with the proxy secret when there is one", () => {
    vi.stubEnv("CREWSTARS_BASE_DOMAIN", BASE);
    vi.stubEnv("API_PROXY_SECRET", "s".repeat(40));
    const headers = upstreamHeaders("admin.stars.genifem.com", "203.0.113.9");
    expect(headers["x-cs-host"]).toBe("admin.stars.genifem.com");
    expect(headers["x-cs-client-ip"]).toBe("203.0.113.9");
    expect(headers["x-cs-proxy-secret"]).toHaveLength(40);
  });
});

describe("subdomainSetup", () => {
  it("names the CNAME relative to the zone, and the domain for Vercel", () => {
    expect(subdomainSetup("acme", BASE)).toEqual({
      host: "acme.stars.genifem.com",
      record: "acme.stars",
      zone: "genifem.com",
    });
    expect(subdomainSetup("acme", "genifem.com")).toEqual({ host: "acme.genifem.com", record: "acme", zone: "genifem.com" });
  });

  it("has nothing to set up on localhost", () => {
    expect(subdomainSetup("demo", "localhost")).toBeNull();
  });
});

describe("slugs", () => {
  it("says what is wrong, in the order to fix it", () => {
    expect(slugProblem("")).toBe("empty");
    expect(slugProblem("a".repeat(33))).toBe("tooLong");
    expect(slugProblem("Acme")).toBe("characters");
    expect(slugProblem("acme burgers")).toBe("characters");
    expect(slugProblem("-acme")).toBe("edges");
    expect(slugProblem("acme-")).toBe("edges");
    expect(slugProblem("admin")).toBe("reserved");
    expect(slugProblem("www")).toBe("reserved");
    expect(slugProblem("acme")).toBeNull();
    expect(slugProblem("a")).toBeNull();
    expect(slugProblem("acme-burgers-2")).toBeNull();
  });

  it("suggests one from a company name", () => {
    expect(suggestSlug("Acme Burgers, Inc.")).toBe("acme-burgers-inc");
    expect(suggestSlug("  Café Olé!  ")).toBe("cafe-ole");
    expect(suggestSlug("---")).toBe("");
    expect(suggestSlug("x".repeat(40))).toHaveLength(32);
    expect(suggestSlug(`${"a".repeat(31)} b`)).toBe("a".repeat(31));
  });
});
