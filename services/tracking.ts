import {
  getLanderCountryCode,
  landerApiUrl,
  resolveVisitor,
} from "./lander-api";
import { computeScrollPct, createExitState } from "./tracking-core";

// Sent as text/plain: a CORS-safelisted type, so these cross-origin beacons
// need no preflight (and sendBeacon cannot post application/json
// cross-origin everywhere). The API parses the JSON text either way.
const BEACON_TYPE = "text/plain;charset=UTF-8";

export interface LanderTracker {
  trackClick(target: string): void;
  trackLink(target: string): void;
  trackStep(stepId: string, label?: string | null): void;
  destroy(): void;
}

const noop: LanderTracker = {
  trackClick() {},
  trackLink() {},
  trackStep() {},
  destroy() {},
};

/**
 * Beacon that creates the LanderSession on the lander API (POST /v1/view) and
 * returns its sessionId. The page no longer records the view during SSR, so
 * this runs on mount. Best-effort: null on any failure — tracking must never
 * break the lander.
 */
export async function createLanderSession(opts: {
  landingPageId: string;
}): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const visitor = resolveVisitor();
    const res = await fetch(landerApiUrl("/v1/view"), {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": BEACON_TYPE },
      body: JSON.stringify({
        landingPageId: opts.landingPageId,
        referrer: document.referrer || null,
        search: window.location.search || null,
        visitorId: visitor.visitorId,
        isReturning: visitor.isReturning,
        countryCode: getLanderCountryCode(),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      sessionId?: unknown;
    } | null;
    return typeof data?.sessionId === "string" ? data.sessionId : null;
  } catch {
    return null;
  }
}

export function initLanderTracking(opts: {
  sessionId: string;
}): LanderTracker {
  if (typeof window === "undefined") return noop;
  const { sessionId } = opts;
  const trackUrl = landerApiUrl("/v1/track");
  const startedAt = Date.now();
  const exit = createExitState();
  let maxScroll = 0;
  let trapArmed = false;

  const post = (payload: Record<string, unknown>) => {
    try {
      void fetch(trackUrl, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": BEACON_TYPE },
        body: JSON.stringify({ sessionId, ...payload }),
      }).catch(() => {
        /* tracking must never break the lander */
      });
    } catch {
      /* tracking must never break the lander */
    }
  };

  const sendExit = () => {
    const payload = {
      sessionId,
      type: "exit",
      exitType: exit.resolve(),
      timeOnPageMs: Date.now() - startedAt,
      maxScrollPct: maxScroll,
    };
    // Duplicate exits are fine: the server's exit-type precedence never
    // downgrades, and later time/scroll values are simply fresher.
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: BEACON_TYPE });
      if (!navigator.sendBeacon?.(trackUrl, blob)) post(payload);
    } catch {
      post(payload);
    }
  };

  const onScroll = () => {
    maxScroll = Math.max(
      maxScroll,
      computeScrollPct(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
      ),
    );
  };
  const onPageHide = () => sendExit();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") sendExit();
  };
  const onPopState = () => {
    if (!trapArmed) return;
    trapArmed = false;
    exit.markBack();
    sendExit();
    // Let the back press actually leave the page.
    window.history.back();
  };

  try {
    if ((window.history.state as { oxyTrack?: boolean } | null)?.oxyTrack !== true) {
      window.history.pushState({ oxyTrack: true }, "", window.location.href);
    }
    trapArmed = true;
  } catch {
    /* history API unavailable — back detection degrades to "closed" */
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("popstate", onPopState);
  onScroll();

  return {
    trackClick(target: string) {
      exit.markClick();
      post({ type: "click", clickTarget: target });
    },
    trackLink(target: string) {
      post({ type: "link", clickTarget: target });
    },
    trackStep(stepId: string, label?: string | null) {
      post({ type: "step", stepId, label: label ?? null });
    },
    destroy() {
      trapArmed = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("popstate", onPopState);
    },
  };
}
