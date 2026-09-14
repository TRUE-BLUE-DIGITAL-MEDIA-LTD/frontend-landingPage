export const NETLIFY_GEO_HEADER = "x-nf-geo";

interface NetlifyGeoPayload {
  country?: { code?: string; name?: string };
}

// Country names must stay aligned with the historical ip-api.com values
// already stored in analytics ("United States", "Thailand", ...), so the
// ISO code is resolved through Intl.DisplayNames rather than trusting the
// header's own name field.
const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return undefined;
  }
})();

function decodeGeoPayload(raw: string): NetlifyGeoPayload | undefined {
  // Netlify sends the header base64-encoded; local dev tooling may pass
  // plain JSON. Try base64 first, then fall back to direct parsing.
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* fall through to plain JSON */
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* not geo data */
  }
  return undefined;
}

/**
 * Resolve the visitor's full country name (e.g. "Thailand") from Netlify's
 * x-nf-geo request header (base64-encoded JSON injected by the platform on
 * every function invocation). Best-effort: any missing or malformed value
 * yields undefined. Never throws — a geo lookup must never fail the caller.
 */
export function countryFromNetlifyHeader(
  headerValue: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!raw) return undefined;
  const geo = decodeGeoPayload(raw);
  const code = geo?.country?.code;
  if (typeof code === "string" && /^[a-z]{2}$/i.test(code)) {
    try {
      const name = REGION_NAMES?.of(code.toUpperCase());
      // DisplayNames echoes the code back when it has no name for it.
      if (name && name !== code.toUpperCase()) return name;
    } catch {
      /* invalid region code — fall back to the payload name */
    }
  }
  const name = geo?.country?.name;
  return typeof name === "string" && name !== "" ? name : undefined;
}
