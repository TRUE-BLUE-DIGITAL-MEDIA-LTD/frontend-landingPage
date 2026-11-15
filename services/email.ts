import { getLanderCountryCode, postLanderApi } from "./lander-api";

/** Saves the visitor's email as a lead for this lander. Rejects on failure. */
export function CreateEmailService({
  email,
  landingPageId,
}: {
  email: string;
  landingPageId: string;
}): Promise<{ ok: boolean }> {
  return postLanderApi("/v1/customers", {
    email,
    landingPageId,
    countryCode: getLanderCountryCode(),
  });
}

/**
 * Deep email check (MX records + NeverBounce). Resolves true / false.
 * Rejects when the check itself could not run (API unreachable, rate limit);
 * callers treat a rejection as "let the visitor through".
 */
export function ValidateEmail({ email }: { email: string }): Promise<boolean> {
  // The API itself gives up on a slow lookup after 5 s; wait a little longer
  // than that so its answer can still arrive.
  return postLanderApi("/v1/customers/validate", { email }, 8000);
}
