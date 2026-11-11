import { describe, expect, it } from "vitest";

import { takeLocale, takeTokens } from "./session";

const tokens = () => ({
  access_token: "access",
  token_type: "bearer",
  expires_in: 900,
  refresh_token: "refresh",
  user: { id: "o1", holder: "owner", name: "Grant Ellis", first_name: "Grant", language: "es" },
});

describe("takeTokens", () => {
  it("takes a refresh's tokens (TokenOut) and strips them from the body", () => {
    const body = tokens();
    expect(takeTokens(body)).toEqual({ access_token: "access", expires_in: 900, refresh_token: "refresh" });
    expect(body).not.toHaveProperty("access_token");
    expect(body).not.toHaveProperty("refresh_token");
    expect(body.user.name).toBe("Grant Ellis");
  });

  it("takes an owner sign-in's tokens (OwnerAuthOut.tokens)", () => {
    const body = { step: "done", tokens: tokens(), mfa_token: null };
    expect(takeTokens(body)?.access_token).toBe("access");
    expect(body.tokens).not.toHaveProperty("access_token");
    expect(body.tokens).not.toHaveProperty("refresh_token");
  });

  it("takes the tokens mfa/confirm nests under auth, and leaves the recovery codes", () => {
    const body = { recovery_codes: ["ABCD2345EF"], auth: { step: "done", tokens: tokens(), mfa_token: null } };
    expect(takeTokens(body)).toEqual({ access_token: "access", expires_in: 900, refresh_token: "refresh" });
    expect(body.auth.tokens).not.toHaveProperty("access_token");
    expect(body.auth.tokens).not.toHaveProperty("refresh_token");
    expect(body.recovery_codes).toEqual(["ABCD2345EF"]);
  });

  it("finds nothing in a step that asks for a code", () => {
    expect(takeTokens({ step: "mfa", tokens: null, mfa_token: "short-lived" })).toBeNull();
    expect(takeTokens({ step: "mfa_setup", mfa_token: "short-lived" })).toBeNull();
    expect(takeTokens(null)).toBeNull();
    expect(takeTokens([tokens()])).toBeNull();
  });

  it("keeps a missing refresh token as null", () => {
    const body = { ...tokens(), refresh_token: undefined };
    expect(takeTokens(body)?.refresh_token).toBeNull();
  });
});

describe("takeLocale", () => {
  it("reads the signed-in user's language wherever the tokens are", () => {
    expect(takeLocale(tokens())).toBe("es");
    expect(takeLocale({ step: "done", tokens: tokens() })).toBe("es");
    expect(takeLocale({ recovery_codes: [], auth: { step: "done", tokens: tokens() } })).toBe("es");
  });

  it("is null without a user", () => {
    expect(takeLocale({ step: "mfa", tokens: null })).toBeNull();
    expect(takeLocale(undefined)).toBeNull();
  });
});
