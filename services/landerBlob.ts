import { getStore } from "@netlify/blobs";
import type {
  Domain,
  Language,
  ResponseGetLandingPageService,
} from "../interfaces";
import { LANDER_API_DEV_ORIGIN } from "./lander-api";
import { pickLander } from "./pick-lander";

export const LANDER_BLOB_STORE = "landers";
export const LANDER_BLOB_KEY = "domain";
export const LANDER_VERSION_HEADER = "x-oxy-lander-version";

/** Mirror of servers/server-dashboard/src/lander-publish/lander-blob.builder.ts. */
export interface LanderBlobLander {
  id: string;
  percent: number;
  route: string | null;
  language: string;
  primaryLanguage: string | null;
  supportedLanguages: string[];
  translations: unknown;
  html: string;
  directLink: string | null;
  backgroundImage: string | null;
  description: string | null;
  mainButton: string;
  title: string | null;
  icon: string | null;
  backOffer: string | null;
  secondOffer: string | null;
}

export interface LanderBlob {
  version: string;
  domain: { id: string; name: string; googleAnalyticsId: string | null };
  landers: LanderBlobLander[];
}

type GetStoreImpl = (name: string) => { get: (key: string, opts: { type: "json" }) => Promise<unknown> };

// On Netlify the runtime injects the store context. Locally, NETLIFY_SITE_ID +
// NETLIFY_BLOBS_TOKEN point at a real site; without them there is no store.
function defaultGetStore(name: string) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

export async function readLanderBlob(getStoreImpl: GetStoreImpl = defaultGetStore): Promise<LanderBlob | null> {
  const value = await getStoreImpl(LANDER_BLOB_STORE).get(LANDER_BLOB_KEY, { type: "json" });
  return (value as LanderBlob | null) ?? null;
}

/** Same A/B, route and language rules as the old Mongo path; same return shape. */
export function pickFromBlob(
  blob: LanderBlob | null,
  opts: { host: string; language: Language; route?: string },
): ResponseGetLandingPageService {
  if (!blob) {
    return { domain: { name: opts.host } } as unknown as ResponseGetLandingPageService;
  }
  const domain = blob.domain as unknown as Domain;
  const picked = pickLander(blob.landers, { route: opts.route, language: opts.language });
  if (!picked) {
    return { domain } as unknown as ResponseGetLandingPageService;
  }
  return { ...picked, domain } as unknown as ResponseGetLandingPageService;
}

/**
 * Local dev has no Netlify Blobs context. Unless NETLIFY_SITE_ID +
 * NETLIFY_BLOBS_TOKEN point at a real site, dev asks a locally running
 * lander API (servers/lander-api, started with DEV_LANDER_BLOB=1) for the
 * same blob, built straight from the dev database. This app itself has no
 * database access. Production never takes this branch.
 */
export function shouldUseDevApi(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NEXT_PUBLIC_NODE_ENV !== "development") return false;
  return !(env.NETLIFY_SITE_ID && env.NETLIFY_BLOBS_TOKEN);
}

export async function readLanderBlobFromDevApi(
  host: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LanderBlob | null> {
  const url = `${LANDER_API_DEV_ORIGIN}/dev/lander-blob?host=${encodeURIComponent(host)}`;
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch {
    throw new Error(
      `Local lander API is not reachable at ${LANDER_API_DEV_ORIGIN}. Start servers/lander-api with DEV_LANDER_BLOB=1 and PORT=8282.`,
    );
  }
  if (res.status === 404 && (await isUnknownDomain(res))) {
    // Same message the old dev database path gave for an unknown domain.
    throw new Error("This domain doesn't exist in our system");
  }
  if (!res.ok) {
    throw new Error(
      `Local lander API answered ${res.status} for /dev/lander-blob. Is it started with DEV_LANDER_BLOB=1?`,
    );
  }
  return ((await res.json()) as LanderBlob | null) ?? null;
}

async function isUnknownDomain(res: Response): Promise<boolean> {
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { errors?: string[] } | null;
  return body?.errors?.[0] === "DOMAIN_UNKNOWN";
}

export async function GetLandingPageFromBlob(dto: {
  host: string;
  language: Language;
  route?: string;
}): Promise<{ landingPage: ResponseGetLandingPageService; version: string | null }> {
  const blob = shouldUseDevApi()
    ? await readLanderBlobFromDevApi(dto.host)
    : await readLanderBlob();
  return { landingPage: pickFromBlob(blob, dto), version: blob?.version ?? null };
}
