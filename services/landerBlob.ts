import { getStore } from "@netlify/blobs";
import type { Domain, Language } from "../interfaces";
import type { ResponseGetLandingPageService } from "./landingPage";
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
 * NETLIFY_BLOBS_TOKEN point at a real site, dev reads the lander straight from
 * the dev Mongo (the pre-blob path). Production never takes this branch.
 */
export function shouldUseDevMongo(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NEXT_PUBLIC_NODE_ENV !== "development") return false;
  return !(env.NETLIFY_SITE_ID && env.NETLIFY_BLOBS_TOKEN);
}

async function getLandingPageFromDevMongo(dto: {
  host: string;
  language: Language;
  route?: string;
}): Promise<ResponseGetLandingPageService> {
  const [{ PrismaClient }, { GetLandingPageService }] = await Promise.all([
    import("@prisma/client"),
    import("./landingPage"),
  ]);
  // Reuse one client across hot reloads.
  const g = globalThis as unknown as { __oxyDevPrisma?: InstanceType<typeof PrismaClient> };
  g.__oxyDevPrisma ??= new PrismaClient();
  return GetLandingPageService({
    domain: dto.host,
    language: dto.language,
    route: dto.route,
    prisma: g.__oxyDevPrisma,
  });
}

export async function GetLandingPageFromBlob(dto: {
  host: string;
  language: Language;
  route?: string;
}): Promise<{ landingPage: ResponseGetLandingPageService; version: string | null }> {
  if (shouldUseDevMongo()) {
    return { landingPage: await getLandingPageFromDevMongo(dto), version: null };
  }
  const blob = await readLanderBlob();
  return { landingPage: pickFromBlob(blob, dto), version: blob?.version ?? null };
}
