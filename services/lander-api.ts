/**
 * The central lander API (servers/lander-api): one service for every
 * published lander's leads, analytics and merchant signups, so the 500+
 * Netlify sites hold no secrets and open no database connections.
 *
 * The origin is a constant, not an environment variable, on purpose — an env
 * var would have to be set on every Netlify site.
 */
export const LANDER_API_ORIGIN = "https://lander-api.oxyclick.com";
export const LANDER_API_DEV_ORIGIN = "http://localhost:3001";

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** API origin for a lander served on `hostname` (local dev talks to a local API). */
export function landerApiOrigin(hostname: string): string {
  return isLocalHost(hostname.split(":")[0])
    ? LANDER_API_DEV_ORIGIN
    : LANDER_API_ORIGIN;
}

/** Absolute URL of an API route, e.g. landerApiUrl("/v1/track"). Browser only. */
export function landerApiUrl(path: string): string {
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  return `${landerApiOrigin(hostname)}${path}`;
}

/**
 * fetch() that gives up after `ms`. The API is on another host than the
 * page: when it is slow or unreachable, a form must fall back to its
 * redirect rather than leave the visitor on "Loading..".
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const POST_TIMEOUT_MS = 5000;

/**
 * JSON POST to the lander API. Resolves with the parsed answer; rejects with
 * the parsed error body (undefined when there is none, e.g. the API is
 * unreachable or too slow) on any non-2xx answer or network failure.
 */
export async function postLanderApi<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number = POST_TIMEOUT_MS,
): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      landerApiUrl(path),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  } catch {
    throw undefined;
  }
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw data;
  return data as T;
}

/**
 * The visitor's ISO country code, resolved by the lander server from
 * Netlify's geo header and handed to the page as a prop. The API cannot see
 * Netlify's header, so every call passes it along.
 */
let countryCode: string | null = null;

export function setLanderCountryCode(code: string | null | undefined): void {
  countryCode = code ?? null;
}

export function getLanderCountryCode(): string | null {
  return countryCode;
}

const VISITOR_KEY = "oxy_vid";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** crypto.randomUUID is missing on older Safari / Chrome; same format by hand. */
export function newVisitorId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

/**
 * The id from the visitor cookie the lander used to set itself (HttpOnly, so
 * only the server can read it — it arrives as a page prop). Seeding from it
 * keeps existing visitors "returning" after the move to localStorage.
 */
let legacyVisitorId: string | null = null;

export function setLegacyVisitorId(id: string | null | undefined): void {
  legacyVisitorId = typeof id === "string" && UUID_RE.test(id) ? id : null;
}

/**
 * First-party, per-domain visitor identity for analytics: "returning" means
 * this browser has visited THIS domain before. Kept in localStorage because
 * the API lives on another domain and cannot set a first-party cookie.
 * Without storage access every visit is simply a new visitor.
 */
export function resolveVisitor(
  storage?: Pick<Storage, "getItem" | "setItem">,
): {
  visitorId: string | null;
  isReturning: boolean;
} {
  try {
    const store = storage ?? window.localStorage;
    const existing = store.getItem(VISITOR_KEY);
    // Anything that is not one of our ids (another script's value under the
    // same key) is replaced below rather than sent to the API forever.
    if (existing && UUID_RE.test(existing)) {
      return { visitorId: existing, isReturning: true };
    }
    if (legacyVisitorId) {
      store.setItem(VISITOR_KEY, legacyVisitorId);
      return { visitorId: legacyVisitorId, isReturning: true };
    }
    const visitorId = newVisitorId();
    store.setItem(VISITOR_KEY, visitorId);
    return { visitorId, isReturning: false };
  } catch {
    // No storage access. A visitor the old cookie already knew is still a
    // returning one; anyone else is an anonymous new visitor.
    return legacyVisitorId
      ? { visitorId: legacyVisitorId, isReturning: true }
      : { visitorId: null, isReturning: false };
  }
}
