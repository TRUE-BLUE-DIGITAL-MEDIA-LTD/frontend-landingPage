import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolveSelfAnchorToMainLink } from "./main-cta";

const MAIN = "https://offer.example/cmp/X1?sub1=abc";
const PAGE = "https://lander.test/?s1=aff";

const anchorOn = (html: string, url: string): HTMLAnchorElement => {
  const dom = new JSDOM(`<body>${html}</body>`, { url });
  return dom.window.document.querySelector("a") as HTMLAnchorElement;
};

describe("resolveSelfAnchorToMainLink", () => {
  it("rewrites an empty-href new-tab CTA to mainLink in the DOM", () => {
    // The editor exports CTA buttons as <a href=""> — resolves to the page
    // itself. With target="_blank" the click hijack leaves navigation
    // native, so the attribute itself must carry mainLink.
    const anchor = anchorOn(`<a href="" target="_blank">JOIN</a>`, PAGE);
    const href = resolveSelfAnchorToMainLink(anchor, PAGE, MAIN);
    assert.equal(href, MAIN);
    assert.equal(anchor.getAttribute("href"), MAIN);
  });

  it("rewrites an explicit self-URL anchor to mainLink", () => {
    const anchor = anchorOn(`<a href="${PAGE}">JOIN</a>`, PAGE);
    const href = resolveSelfAnchorToMainLink(anchor, PAGE, MAIN);
    assert.equal(href, MAIN);
    assert.equal(anchor.getAttribute("href"), MAIN);
  });

  it('rewrites href="#" to mainLink in the DOM', () => {
    // "#" resolves to currentHref + "#", so it fails the strict equality —
    // but it is still a self-pointing CTA, not a real destination.
    const anchor = anchorOn(`<a href="#">JOIN</a>`, PAGE);
    const href = resolveSelfAnchorToMainLink(anchor, PAGE, MAIN);
    assert.equal(href, MAIN);
    assert.equal(anchor.getAttribute("href"), MAIN);
  });

  it('rewrites a new-tab href="#" CTA to mainLink in the DOM', () => {
    const anchor = anchorOn(`<a href="#" target="_blank">JOIN</a>`, PAGE);
    const href = resolveSelfAnchorToMainLink(anchor, PAGE, MAIN);
    assert.equal(href, MAIN);
    assert.equal(anchor.getAttribute("href"), MAIN);
  });

  it("leaves in-page section links (#section) untouched", () => {
    const anchor = anchorOn(`<a href="#pricing">See pricing</a>`, PAGE);
    const href = resolveSelfAnchorToMainLink(anchor, PAGE, MAIN);
    assert.equal(href, `${PAGE}#pricing`);
    assert.equal(anchor.getAttribute("href"), "#pricing");
  });

  it("leaves anchors with a real destination untouched", () => {
    const policy = "https://privacy.example/policy";
    const anchor = anchorOn(
      `<a href="${policy}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>`,
      PAGE,
    );
    const href = resolveSelfAnchorToMainLink(anchor, PAGE, MAIN);
    assert.equal(href, policy);
    assert.equal(anchor.getAttribute("href"), policy);
  });

  it("returns the resolved href unchanged when mainLink is missing", () => {
    const anchor = anchorOn(`<a href="">JOIN</a>`, PAGE);
    const href = resolveSelfAnchorToMainLink(anchor, PAGE, undefined);
    assert.equal(href, PAGE);
    assert.equal(anchor.getAttribute("href"), "");
  });
});
