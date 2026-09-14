import { describe, expect, it } from "vitest";
import { pickLander, LanderCandidate } from "./pick-lander";

function lander(overrides: Partial<LanderCandidate> & { id: string }): LanderCandidate {
  return {
    percent: 100,
    route: null,
    supportedLanguages: [],
    language: "en",
    ...overrides,
  };
}

describe("pickLander", () => {
  it("returns undefined for an empty pool", () => {
    expect(pickLander([], { language: "en" })).toBeUndefined();
  });

  it("only considers route-less landers when no route is requested", () => {
    const picked = pickLander(
      [lander({ id: "routed", route: "promo" }), lander({ id: "root" })],
      { language: "en" },
      () => 0.5,
    );
    expect(picked?.id).toBe("root");
  });

  it("only considers landers on the requested route", () => {
    const picked = pickLander(
      [lander({ id: "root" }), lander({ id: "routed", route: "promo" })],
      { language: "en", route: "promo" },
      () => 0.5,
    );
    expect(picked?.id).toBe("routed");
  });

  it("excludes landers with percent <= 0", () => {
    const picked = pickLander(
      [lander({ id: "off", percent: 0 }), lander({ id: "on", percent: 50 })],
      { language: "en" },
      () => 0.99,
    );
    expect(picked?.id).toBe("on");
    expect(
      pickLander([lander({ id: "off", percent: 0 })], { language: "en" }),
    ).toBeUndefined();
  });

  it("narrows to landers supporting the visitor's language", () => {
    const picked = pickLander(
      [
        lander({ id: "en-only", supportedLanguages: ["en"] }),
        lander({ id: "de", supportedLanguages: ["de"] }),
      ],
      { language: "de" },
      () => 0.5,
    );
    expect(picked?.id).toBe("de");
  });

  it("falls back to the legacy language field when supportedLanguages is empty", () => {
    const picked = pickLander(
      [
        lander({ id: "legacy-de", language: "de", supportedLanguages: [] }),
        lander({ id: "legacy-en", language: "en", supportedLanguages: null }),
      ],
      { language: "de" },
      () => 0.5,
    );
    expect(picked?.id).toBe("legacy-de");
  });

  it("keeps the whole pool when no lander matches the language", () => {
    const picked = pickLander(
      [lander({ id: "en-only", supportedLanguages: ["en"] })],
      { language: "fr" },
      () => 0.5,
    );
    expect(picked?.id).toBe("en-only");
  });

  it("picks proportionally to percent with an injected random source", () => {
    const pool = [
      lander({ id: "a", percent: 25 }),
      lander({ id: "b", percent: 75 }),
    ];
    expect(pickLander(pool, { language: "en" }, () => 0.1)?.id).toBe("a");
    expect(pickLander(pool, { language: "en" }, () => 0.24)?.id).toBe("a");
    expect(pickLander(pool, { language: "en" }, () => 0.26)?.id).toBe("b");
    expect(pickLander(pool, { language: "en" }, () => 0.9)?.id).toBe("b");
  });

  it("still returns a lander when random lands on the rounding edge", () => {
    const pool = [
      lander({ id: "a", percent: 1 }),
      lander({ id: "b", percent: 3 }),
    ];
    // random() can return values the cumulative float sum never exceeds.
    expect(pickLander(pool, { language: "en" }, () => 0.9999999999)?.id).toBe(
      "b",
    );
  });
});
