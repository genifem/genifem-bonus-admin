import { describe, expect, it } from "vitest";

import { contrastRatio } from "./color";
import {
  crewStars,
  light,
  paletteContrast,
  schemes,
  sidebar,
  sidebarTextContrast,
  textContrast,
  uiContrast,
} from "./tokens";

/**
 * The palette is the one place a contrast mistake reaches every screen at once, and axe only
 * sees the combinations a test happens to render. These assertions cover the contract itself,
 * so a token edit fails here rather than in a browser test that may never reach the state.
 */
describe("tokens", () => {
  for (const [name, scheme] of Object.entries(schemes)) {
    describe(name, () => {
      it.each(textContrast)("%s on %s reaches 4.5:1", (text, background) => {
        const ratio = contrastRatio(scheme[text], scheme[background]);
        expect(ratio, `${text} (${scheme[text]}) on ${background} (${scheme[background]})`)
          .toBeGreaterThanOrEqual(4.5);
      });

      it.each(uiContrast)("%s against %s reaches 3:1", (mark, background) => {
        const ratio = contrastRatio(scheme[mark], scheme[background]);
        expect(ratio, `${mark} (${scheme[mark]}) on ${background} (${scheme[background]})`)
          .toBeGreaterThanOrEqual(3);
      });
    });
  }

  it.each(paletteContrast)("palette: %s on %s reaches 4.5:1", (text, background) => {
    const ratio = contrastRatio(crewStars[text], crewStars[background]);
    expect(ratio, `${text} (${crewStars[text]}) on ${background} (${crewStars[background]})`)
      .toBeGreaterThanOrEqual(4.5);
  });

  it.each(sidebarTextContrast)("rail: %s on %s reaches 4.5:1", (text, background) => {
    const ratio = contrastRatio(sidebar[text], sidebar[background]);
    expect(ratio, `${text} (${sidebar[text]}) on ${background} (${sidebar[background]})`)
      .toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the decorative red off text (plan D17)", () => {
    // If either of these ever passes, the split between red and redAction can be revisited.
    expect(contrastRatio("#FFFFFF", crewStars.red)).toBeLessThan(4.5);
    expect(contrastRatio(crewStars.red, crewStars.cream)).toBeLessThan(4.5);
    for (const value of [light.brand, light.brandInk, light.dangerInk]) {
      expect(value).toBe(crewStars.redAction);
    }
  });

  it("keeps every colour a six-digit hex, which the generator and React Native both assume", () => {
    for (const [key, value] of Object.entries({ ...light, ...crewStars, ...sidebar })) {
      expect(value, key).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
