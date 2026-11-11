import { describe, expect, it } from "vitest";

import { createTranslator, fill } from "./translate";

describe("createTranslator", () => {
  it("reads dotted keys in the chosen language", () => {
    expect(createTranslator("es")("login.submit")).toBe("Iniciar sesión");
    expect(createTranslator("en")("login.submit")).toBe("Sign in");
  });

  it("fills placeholders", () => {
    expect(createTranslator("en")("pages.overview.title", { name: "Grant", month: "October" })).toBe(
      "Hi Grant, here's October",
    );
    expect(createTranslator("es")("pages.overview.title", { name: "Grant", month: "octubre" })).toBe(
      "Hola, Grant. Así va octubre",
    );
  });

  it("falls back to English for a key a translation is missing", () => {
    const t = createTranslator("es");
    expect(t.has("login.submit")).toBe(true);
    expect(t.has("nothing.here")).toBe(false);
    expect(t("nothing.here")).toBe("nothing.here");
  });

  it("leaves unknown placeholders alone rather than printing undefined", () => {
    expect(fill("Hello, {name} of {store}", { name: "Ava" })).toBe("Hello, Ava of {store}");
  });
});
