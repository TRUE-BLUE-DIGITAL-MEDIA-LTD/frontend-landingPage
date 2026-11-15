/**
 * Legacy "direct link" registration: posts the visitor's email straight to a
 * merchant endpoint configured on the lander (LandingPage.directLink) and
 * resolves with its answer (`{ status, location }`). Rejects with the
 * merchant's error body on a non-2xx answer or when the request fails —
 * callers then fall back to the main offer link. The request is given up
 * after ten seconds so a stalled merchant cannot hold the visitor.
 *
 * NOTE: the API key and the fixed profile values below ship to the browser.
 * They predate the central lander API (servers/lander-api); new merchant
 * integrations belong there, where secrets stay on the server.
 */
import { fetchWithTimeout } from "./lander-api";

const DIRECT_LINK_TIMEOUT_MS = 10_000;

export async function DirectLinkService({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<{ status?: string; location?: string }> {
  const target = new URL(url);
  target.searchParams.set("tds_compaign", "s0094bel");

  const res = await fetchWithTimeout(
    target.toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        apiKey:
          "a1h6p7zy5p400vsfcklh35li1vbhixpueepvf4p4k32cn3xeai37knrzurs0exjz",
        sexual_orientation: "hetero",
        gender: "male",
        dob: "1999-03-11",
        ip: "98.207.254.136",
        ua: window.navigator.userAgent,
      }),
    },
    DIRECT_LINK_TIMEOUT_MS,
  );
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw data;
  // A 2xx answer without a JSON body is "no result", not an error.
  return data ?? {};
}
