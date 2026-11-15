/**
 * Browser wiring for the editor's "Dating Signup" block.
 *
 * DOM contract: clients/dashboard/editor/core/tools/signup/render.ts.
 * The form posts to the central lander API (servers/lander-api, POST
 * /v1/profile/create), which holds the merchant token; on success the visitor is sent to the merchant's login
 * URL, already signed in.
 *
 * Failure handling:
 *   • EMAIL_EXISTS / USERNAME_EXISTS — the visitor can fix it: show the
 *     matching message inside the form.
 *   • anything else (rejected geo, cap reached, merchant down, …) — nothing
 *     the visitor can do, so fall back to the lander's main offer link, the
 *     same way the other forms do. Without a main link, show the generic
 *     message.
 */

import {
  fetchWithTimeout,
  getLanderCountryCode,
  landerApiUrl,
} from "./lander-api";

export interface SignupApiResult {
  success: boolean;
  loginUrl?: string;
  errors?: string[];
}

export interface SignupFormDeps {
  landingPageId?: string;
  mainLink?: string;
  /** Fired right before the visitor leaves the lander. */
  onLeave?: (info: { outcome: "created" | "fallback"; url: string }) => void;
  post?: (body: Record<string, unknown>) => Promise<SignupApiResult>;
  navigate?: (url: string) => void;
  search?: string;
  now?: Date;
}

/** Fixable by the visitor, with a dedicated message in the form. */
const RECOVERABLE = ["EMAIL_EXISTS", "USERNAME_EXISTS"];
/**
 * The lander API's validation codes (servers/lander-api signup-payload.ts):
 * also fixable by the visitor, shown with the generic "check your details"
 * message instead of bouncing them to the offer link.
 */
const INVALID_INPUT = [
  "EMAIL_INVALID",
  "USERNAME_INVALID",
  "PASSWORD_INVALID",
  "GENDER_INVALID",
  "BIRTHDATE_INVALID",
];
const MIN_AGE_YEARS = 18;
const MAX_AGE_YEARS = 120;

async function postSignup(
  body: Record<string, unknown>,
): Promise<SignupApiResult> {
  // The API allows the merchant 8 s and the lead save 2 s; past that the
  // caller falls back to the main offer link.
  const res = await fetchWithTimeout(
    landerApiUrl("/v1/profile/create"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    15000,
  );
  return (await res.json()) as SignupApiResult;
}

/**
 * YYYY-MM-DD for "`years` ago today". Uses UTC, like the server's age check,
 * and clamps the day so the result is always a real date (29 Feb → 28 Feb) —
 * browsers silently ignore an invalid min / max.
 */
export function yearsAgo(now: Date, years: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = now.getUTCFullYear() - years;
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDay);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Latest birthdate that is still at least 18 years old. */
export function maxBirthdate(now: Date): string {
  return yearsAgo(now, MIN_AGE_YEARS);
}

/**
 * Tracking sent to the merchant: the block's defaults (cid / source /
 * subsource set in the editor), overridden by the lander URL's own query.
 */
export function buildTracking(
  form: Element,
  search: string,
): Record<string, string> {
  const tracking: Record<string, string> = {};
  for (const key of ["cid", "source", "subsource"]) {
    const value = form.getAttribute(`data-oxy-signup-${key}`);
    if (value) tracking[key] = value;
  }
  new URLSearchParams(search).forEach((value, key) => {
    if (value !== "") tracking[key] = value;
  });
  return tracking;
}

export function fallbackUrl(mainLink: string, email: string): string {
  try {
    const url = new URL(mainLink);
    if (email) url.searchParams.set("sub3", btoa(email));
    return url.toString();
  } catch {
    return mainLink;
  }
}

function showMessage(form: HTMLFormElement, code: string | null): void {
  const box = form.querySelector<HTMLElement>(".oxy-signup__error");
  if (!box) return;
  let shown = false;
  box.querySelectorAll<HTMLElement>("[data-oxy-signup-msg]").forEach((el) => {
    const match = code !== null && el.getAttribute("data-oxy-signup-msg") === code;
    el.hidden = !match;
    if (match) shown = true;
  });
  box.hidden = !shown;
}

function fieldValue(form: HTMLFormElement, name: string): string {
  const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[name="${name}"]`,
  );
  return el ? el.value : "";
}

function wireForm(form: HTMLFormElement, deps: SignupFormDeps): () => void {
  const post = deps.post ?? postSignup;
  const navigate = deps.navigate ?? ((url: string) => window.location.assign(url));
  const button = form.querySelector<HTMLButtonElement>(".oxy-signup__submit");
  const birthdate = form.querySelector<HTMLInputElement>(
    '[name="signup_birthdate"]',
  );
  if (birthdate) {
    const now = deps.now ?? new Date();
    birthdate.max = maxBirthdate(now);
    birthdate.min = yearsAgo(now, MAX_AGE_YEARS);
  }
  showMessage(form, null);

  let busy = false;
  const setBusy = (next: boolean) => {
    busy = next;
    if (!button) return;
    button.disabled = next;
    button.style.opacity = next ? "0.6" : "";
  };

  const submit = async () => {
    if (busy) return;
    if (typeof form.reportValidity === "function" && !form.reportValidity()) {
      return;
    }
    showMessage(form, null);
    setBusy(true);
    const email = fieldValue(form, "signup_email").trim();
    let result: SignupApiResult;
    try {
      result = await post({
        landingPageId: deps.landingPageId,
        merchant: form.getAttribute("data-oxy-signup-merchant") ?? "",
        email,
        username: fieldValue(form, "signup_username").trim(),
        password: fieldValue(form, "signup_password"),
        gender: fieldValue(form, "signup_gender"),
        searchGender: fieldValue(form, "signup_search_gender"),
        birthdate: fieldValue(form, "signup_birthdate"),
        countryCode: getLanderCountryCode(),
        tracking: buildTracking(
          form,
          deps.search ?? (typeof window !== "undefined" ? window.location.search : ""),
        ),
      });
    } catch {
      result = { success: false, errors: ["UPSTREAM_ERROR"] };
    }

    if (result.success && result.loginUrl) {
      let origin = result.loginUrl;
      try {
        // Never hand the one-time login token to analytics.
        origin = new URL(result.loginUrl).origin;
      } catch {
        /* keep as-is */
      }
      deps.onLeave?.({ outcome: "created", url: origin });
      navigate(result.loginUrl);
      return;
    }

    const recoverable = (result.errors ?? []).find((e) =>
      RECOVERABLE.includes(e),
    );
    if (recoverable) {
      showMessage(form, recoverable);
      setBusy(false);
      return;
    }
    if ((result.errors ?? []).some((e) => INVALID_INPUT.includes(e))) {
      showMessage(form, "GENERIC");
      setBusy(false);
      return;
    }
    if (deps.mainLink) {
      const url = fallbackUrl(deps.mainLink, email);
      deps.onLeave?.({ outcome: "fallback", url: deps.mainLink });
      navigate(url);
      return;
    }
    showMessage(form, "GENERIC");
    setBusy(false);
  };

  const onClick = (e: Event) => {
    e.preventDefault();
    void submit();
  };
  const onSubmit = (e: Event) => {
    e.preventDefault();
    void submit();
  };
  // The form has no type="submit" button (the lander's legacy hook hijacks
  // those), so browsers never submit it implicitly: handle Enter and the
  // phone keyboard's "Go" key ourselves.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as Element | null;
    if (!target || target.tagName !== "INPUT") return;
    e.preventDefault();
    void submit();
  };
  // Back button after leaving: the page may be restored from the
  // back-forward cache with the button still disabled.
  const view = form.ownerDocument.defaultView;
  const onPageShow = (e: Event) => {
    if ((e as PageTransitionEvent).persisted) setBusy(false);
  };
  button?.addEventListener("click", onClick);
  form.addEventListener("submit", onSubmit);
  form.addEventListener("keydown", onKeyDown);
  view?.addEventListener("pageshow", onPageShow);
  return () => {
    button?.removeEventListener("click", onClick);
    form.removeEventListener("submit", onSubmit);
    form.removeEventListener("keydown", onKeyDown);
    view?.removeEventListener("pageshow", onPageShow);
  };
}

/** Wires every signup block on the page. Returns a teardown function. */
export function initSignupForms(
  doc: Document,
  deps: SignupFormDeps = {},
): () => void {
  const teardowns = Array.from(
    doc.querySelectorAll<HTMLFormElement>("form.oxy-signup"),
  ).map((form) => wireForm(form, deps));
  return () => teardowns.forEach((fn) => fn());
}
