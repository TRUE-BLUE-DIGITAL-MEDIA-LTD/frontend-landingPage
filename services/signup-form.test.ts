import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import {
  buildTracking,
  fallbackUrl,
  initSignupForms,
  maxBirthdate,
  yearsAgo,
  type SignupApiResult,
} from "./signup-form";

// Mirrors the export of clients/dashboard/editor/core/tools/signup/render.ts.
const FORM_HTML = `
<form class="oxy-signup" data-oxy-signup-merchant="meetmyhookup"
      data-oxy-signup-cid="" data-oxy-signup-source="7" data-oxy-signup-subsource="8">
  <input type="email" name="signup_email" required>
  <input type="text" name="signup_username" required maxlength="25" pattern="[A-Za-z0-9]+">
  <input type="password" name="signup_password" required minlength="6">
  <select name="signup_gender"><option value="MALE" selected>Man</option><option value="FEMALE">Woman</option></select>
  <select name="signup_search_gender"><option value="MALE">Man</option><option value="FEMALE" selected>Woman</option></select>
  <input type="date" name="signup_birthdate" required>
  <div class="oxy-signup__error" hidden>
    <span data-oxy-signup-msg="EMAIL_EXISTS" hidden>email exists</span>
    <span data-oxy-signup-msg="USERNAME_EXISTS" hidden>username exists</span>
    <span data-oxy-signup-msg="GENERIC" hidden>generic</span>
  </div>
  <button type="button" class="oxy-signup__submit">Create my account</button>
</form>`;

function setup(
  result: SignupApiResult | Error,
  opts: { mainLink?: string; fill?: boolean } = {},
) {
  const dom = new JSDOM(FORM_HTML, { url: "https://lander.example/" });
  const doc = dom.window.document;
  const set = (name: string, value: string) => {
    (doc.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value;
  };
  if (opts.fill !== false) {
    set("signup_email", " user@domain.com ");
    set("signup_username", "user1");
    set("signup_password", "strongpassword");
    set("signup_birthdate", "2000-01-21");
  }
  const post = vi.fn(async (_body: Record<string, unknown>) => {
    if (result instanceof Error) throw result;
    return result;
  });
  const navigate = vi.fn();
  const onLeave = vi.fn();
  initSignupForms(doc, {
    landingPageId: "lp1",
    mainLink: opts.mainLink,
    post,
    navigate,
    onLeave,
    search: "?cid=click123&source=9",
    now: new Date(Date.UTC(2026, 10, 12, 12)),
  });
  const button = doc.querySelector(".oxy-signup__submit") as HTMLButtonElement;
  const click = async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const visibleMessage = () => {
    const box = doc.querySelector(".oxy-signup__error") as HTMLElement;
    if (box.hidden) return null;
    const shown = Array.from(
      box.querySelectorAll<HTMLElement>("[data-oxy-signup-msg]"),
    ).filter((el) => !el.hidden);
    return shown.map((el) => el.getAttribute("data-oxy-signup-msg")).join(",");
  };
  return { doc, post, navigate, onLeave, button, click, visibleMessage };
}

describe("signup form runtime", () => {
  it("posts the fields and tracking, then sends the visitor to the login URL", async () => {
    const loginUrl = "https://meetmyhookup.com/api/auth/external-api-login/a/b";
    const t = setup({ success: true, loginUrl });
    await t.click();

    expect(t.post).toHaveBeenCalledTimes(1);
    expect(t.post.mock.calls[0][0]).toEqual({
      landingPageId: "lp1",
      merchant: "meetmyhookup",
      email: "user@domain.com",
      username: "user1",
      password: "strongpassword",
      gender: "MALE",
      searchGender: "FEMALE",
      birthdate: "2000-01-21",
      countryCode: null,
      // URL query overrides the block default (source), default fills the gap.
      tracking: { cid: "click123", source: "9", subsource: "8" },
    });
    expect(t.navigate).toHaveBeenCalledWith(loginUrl);
    // Analytics gets the origin only, never the one-time login token.
    expect(t.onLeave).toHaveBeenCalledWith({
      outcome: "created",
      url: "https://meetmyhookup.com",
    });
  });

  it("does not submit an incomplete form", async () => {
    const t = setup({ success: true, loginUrl: "https://x.example/" }, {
      fill: false,
    });
    await t.click();
    expect(t.post).not.toHaveBeenCalled();
  });

  it("shows a fixable error in place and lets the visitor retry", async () => {
    const t = setup(
      { success: false, errors: ["USERNAME_EXISTS"] },
      { mainLink: "https://offer.example/go" },
    );
    await t.click();
    expect(t.visibleMessage()).toBe("USERNAME_EXISTS");
    expect(t.navigate).not.toHaveBeenCalled();
    expect(t.button.disabled).toBe(false);
    await t.click();
    expect(t.post).toHaveBeenCalledTimes(2);
  });

  it("falls back to the main offer link when the signup cannot succeed", async () => {
    const t = setup(
      { success: false, errors: ["REGISTRATION_REJECTED"] },
      { mainLink: "https://offer.example/go?sub1=a" },
    );
    await t.click();
    expect(t.navigate).toHaveBeenCalledWith(
      `https://offer.example/go?sub1=a&sub3=${encodeURIComponent(
        btoa("user@domain.com"),
      )}`,
    );
    expect(t.onLeave).toHaveBeenCalledWith({
      outcome: "fallback",
      url: "https://offer.example/go?sub1=a",
    });
  });

  it("falls back when the request itself fails", async () => {
    const t = setup(new Error("network"), {
      mainLink: "https://offer.example/go",
    });
    await t.click();
    expect(t.navigate).toHaveBeenCalledTimes(1);
  });

  it("shows the generic message when there is no main link", async () => {
    const t = setup({ success: false, errors: ["COUNTRY_INVALID"] });
    await t.click();
    expect(t.visibleMessage()).toBe("GENERIC");
    expect(t.navigate).not.toHaveBeenCalled();
  });

  it("limits the birthdate picker to 18–120 years old", () => {
    const t = setup({ success: false });
    const input = t.doc.querySelector(
      '[name="signup_birthdate"]',
    ) as HTMLInputElement;
    expect(input.max).toBe("2008-11-12");
    expect(input.min).toBe("1906-11-12");
  });

  it("computes dates in UTC and never produces an invalid date", () => {
    // 23:30 UTC on the 12th is already the 13th east of UTC; the server
    // (UTC) still counts the 12th.
    expect(maxBirthdate(new Date(Date.UTC(2026, 10, 12, 23, 30)))).toBe(
      "2008-11-12",
    );
    // 29 Feb 2028 minus 18 years: 2010 has no 29 Feb.
    expect(yearsAgo(new Date(Date.UTC(2028, 1, 29, 12)), 18)).toBe("2010-02-28");
  });

  it("lets the visitor fix a field the server rejected", async () => {
    const t = setup(
      { success: false, errors: ["BIRTHDATE_INVALID"] },
      { mainLink: "https://offer.example/go" },
    );
    await t.click();
    expect(t.visibleMessage()).toBe("GENERIC");
    expect(t.navigate).not.toHaveBeenCalled();
    expect(t.button.disabled).toBe(false);
  });

  it("submits on Enter inside a field, once", async () => {
    const t = setup({ success: true, loginUrl: "https://m.example/login" });
    const input = t.doc.querySelector('[name="signup_username"]')!;
    const enter = () =>
      input.dispatchEvent(
        new (t.doc.defaultView!.KeyboardEvent)("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    enter();
    enter();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(t.post).toHaveBeenCalledTimes(1);
    expect(t.navigate).toHaveBeenCalledWith("https://m.example/login");
  });
});

describe("helpers", () => {
  it("buildTracking ignores empty defaults and empty query values", () => {
    const dom = new JSDOM(
      `<form data-oxy-signup-cid="" data-oxy-signup-source="1"></form>`,
    );
    const form = dom.window.document.querySelector("form")!;
    expect(buildTracking(form, "?cid=&utm=x")).toEqual({
      source: "1",
      utm: "x",
    });
  });

  it("fallbackUrl tolerates a malformed main link", () => {
    expect(fallbackUrl("not a url", "a@b.co")).toBe("not a url");
  });
});
