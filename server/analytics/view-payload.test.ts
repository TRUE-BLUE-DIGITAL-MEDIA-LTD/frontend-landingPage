import { describe, expect, it } from "vitest";
import { parseViewPayload, queryFromSearch } from "./view-payload";

const LP_ID = "64b1f0aa2f9c1e0012345678";

describe("parseViewPayload", () => {
  it("accepts a valid payload", () => {
    expect(
      parseViewPayload({
        landingPageId: LP_ID,
        referrer: "https://google.com/",
        search: "?utm_source=fb",
      }),
    ).toEqual({
      landingPageId: LP_ID,
      referrer: "https://google.com/",
      search: "?utm_source=fb",
    });
  });

  it("accepts a JSON string body (sendBeacon delivery)", () => {
    expect(parseViewPayload(JSON.stringify({ landingPageId: LP_ID }))).toEqual(
      { landingPageId: LP_ID, referrer: null, search: null },
    );
  });

  it("rejects a missing or malformed landingPageId", () => {
    expect(parseViewPayload({})).toBeNull();
    expect(parseViewPayload({ landingPageId: "not-an-object-id" })).toBeNull();
    expect(parseViewPayload({ landingPageId: 42 })).toBeNull();
    expect(parseViewPayload(null)).toBeNull();
    expect(parseViewPayload("not json")).toBeNull();
  });

  it("caps oversized referrer and search values", () => {
    const parsed = parseViewPayload({
      landingPageId: LP_ID,
      referrer: "r".repeat(600),
      search: "s".repeat(3000),
    });
    expect(parsed?.referrer).toHaveLength(512);
    expect(parsed?.search).toHaveLength(2048);
  });
});

describe("queryFromSearch", () => {
  it("parses a search string with a leading question mark", () => {
    expect(
      queryFromSearch("?utm_source=fb&utm_medium=cpc&x=1"),
    ).toEqual({ utm_source: "fb", utm_medium: "cpc", x: "1" });
  });

  it("returns an empty record for null or empty input", () => {
    expect(queryFromSearch(null)).toEqual({});
    expect(queryFromSearch("")).toEqual({});
  });
});
