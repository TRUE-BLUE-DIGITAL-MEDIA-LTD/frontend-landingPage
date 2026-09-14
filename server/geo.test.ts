import { describe, expect, it } from "vitest";
import { countryFromNetlifyHeader } from "./geo";

function encode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

describe("countryFromNetlifyHeader", () => {
  it("resolves the country name from a base64 x-nf-geo payload", () => {
    expect(
      countryFromNetlifyHeader(
        encode({ country: { code: "TH", name: "Thailand" } }),
      ),
    ).toBe("Thailand");
    expect(
      countryFromNetlifyHeader(
        encode({ country: { code: "US", name: "United States of America" } }),
      ),
    ).toBe("United States");
  });

  it("prefers the ISO code over the payload name for naming consistency", () => {
    // Header name variants must not fragment analytics country values.
    expect(
      countryFromNetlifyHeader(
        encode({ country: { code: "GB", name: "Britain" } }),
      ),
    ).toBe("United Kingdom");
  });

  it("falls back to the payload name when the code is missing or invalid", () => {
    expect(
      countryFromNetlifyHeader(encode({ country: { name: "Thailand" } })),
    ).toBe("Thailand");
    expect(
      countryFromNetlifyHeader(
        encode({ country: { code: "XXX", name: "Somewhere" } }),
      ),
    ).toBe("Somewhere");
  });

  it("accepts a plain-JSON (unencoded) header value", () => {
    expect(
      countryFromNetlifyHeader(JSON.stringify({ country: { code: "TH" } })),
    ).toBe("Thailand");
  });

  it("uses the first value of a repeated header", () => {
    expect(
      countryFromNetlifyHeader([
        encode({ country: { code: "TH" } }),
        encode({ country: { code: "US" } }),
      ]),
    ).toBe("Thailand");
  });

  it("returns undefined for missing or malformed values", () => {
    expect(countryFromNetlifyHeader(undefined)).toBeUndefined();
    expect(countryFromNetlifyHeader("")).toBeUndefined();
    expect(countryFromNetlifyHeader("not-base64-json")).toBeUndefined();
    expect(countryFromNetlifyHeader(encode({}))).toBeUndefined();
    expect(countryFromNetlifyHeader(encode({ country: {} }))).toBeUndefined();
    expect(countryFromNetlifyHeader(encode("just a string"))).toBeUndefined();
  });
});
