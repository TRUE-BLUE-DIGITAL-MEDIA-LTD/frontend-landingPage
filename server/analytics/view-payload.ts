import { capStr } from "./visit-context";

export interface ViewPayload {
  landingPageId: string;
  referrer: string | null;
  search: string | null;
}

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

export function parseViewPayload(body: unknown): ViewPayload | null {
  let raw: any = body;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  if (
    typeof raw.landingPageId !== "string" ||
    !OBJECT_ID_RE.test(raw.landingPageId)
  ) {
    return null;
  }
  return {
    landingPageId: raw.landingPageId,
    referrer: capStr(raw.referrer, 512),
    search: capStr(raw.search, 2048),
  };
}

/** Turn a location.search string into the query record parseUtm expects. */
export function queryFromSearch(
  search: string | null,
): Record<string, unknown> {
  if (!search) return {};
  try {
    return Object.fromEntries(new URLSearchParams(search));
  } catch {
    return {};
  }
}
