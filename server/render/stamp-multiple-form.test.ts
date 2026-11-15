import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { stampMultipleFormMeta } from "./stamp-multiple-form";

describe("stampMultipleFormMeta", () => {
  it("stamps id and fallback link on every form root", () => {
    const dom = new JSDOM(
      `<div class="oxy-multiple-form"></div><div class="oxy-multiple-form"></div>`,
    );
    stampMultipleFormMeta(dom.window.document, {
      landingPageId: "lp123",
      fallbackLink: "https://partner.example/go",
    });
    const roots = dom.window.document.querySelectorAll(".oxy-multiple-form");
    roots.forEach((root) => {
      expect(root.getAttribute("data-oxy-lp-id")).toBe("lp123");
      expect(root.getAttribute("data-oxy-fallback-link")).toBe(
        "https://partner.example/go",
      );
    });
  });

  it("stamps the lander API origin and country when provided", () => {
    const dom = new JSDOM(`<div class="oxy-multiple-form"></div>`);
    stampMultipleFormMeta(dom.window.document, {
      landingPageId: "lp123",
      fallbackLink: "",
      apiOrigin: "https://lander-api.example",
      countryCode: "DE",
    });
    const root = dom.window.document.querySelector(".oxy-multiple-form")!;
    expect(root.getAttribute("data-oxy-api")).toBe("https://lander-api.example");
    expect(root.getAttribute("data-oxy-country")).toBe("DE");
  });

  it("leaves both unstamped when unknown, so the runtime keeps its fallback", () => {
    const dom = new JSDOM(`<div class="oxy-multiple-form"></div>`);
    stampMultipleFormMeta(dom.window.document, {
      landingPageId: "lp123",
      fallbackLink: "",
    });
    const root = dom.window.document.querySelector(".oxy-multiple-form")!;
    expect(root.hasAttribute("data-oxy-api")).toBe(false);
    expect(root.hasAttribute("data-oxy-country")).toBe(false);
  });

  it("is a no-op on pages without the form", () => {
    const dom = new JSDOM(`<div class="other"></div>`);
    expect(() =>
      stampMultipleFormMeta(dom.window.document, {
        landingPageId: "lp123",
        fallbackLink: "",
      }),
    ).not.toThrow();
  });
});
