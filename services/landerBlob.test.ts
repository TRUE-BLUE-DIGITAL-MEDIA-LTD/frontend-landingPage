import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  LANDER_VERSION_HEADER,
  pickFromBlob,
  readLanderBlob,
  readLanderBlobFromDevApi,
  shouldUseDevApi,
} from "./landerBlob";
import { LANDER_API_DEV_ORIGIN } from "./lander-api";

const lander = (over: Partial<any> = {}) => ({
  id: "l1", percent: 100, route: null, language: "en", primaryLanguage: "en",
  supportedLanguages: ["en"], translations: null, html: "<h1>hi</h1>", directLink: null,
  backgroundImage: null, description: "D", mainButton: "https://m", title: "T", icon: null,
  backOffer: null, secondOffer: null, ...over,
});
const blob = (landers = [lander()]) => ({
  version: "v1",
  domain: { id: "d1", name: "example.com", googleAnalyticsId: "G-1" },
  landers,
});

describe("landerBlob", () => {
  it("exports the version header name", () => {
    assert.equal(LANDER_VERSION_HEADER, "x-oxy-lander-version");
  });

  it("readLanderBlob returns the parsed json from store 'landers' key 'domain'", async () => {
    const calls: any[] = [];
    const getStoreImpl = (name: string) => {
      calls.push(name);
      return { get: async (key: string, opts: any) => { calls.push(key, opts); return blob(); } };
    };
    const out = await readLanderBlob(getStoreImpl as any);
    assert.deepEqual(out, blob());
    assert.deepEqual(calls, ["landers", "domain", { type: "json" }]);
  });

  it("readLanderBlob returns null when the store has no blob", async () => {
    const getStoreImpl = () => ({ get: async () => null });
    assert.equal(await readLanderBlob(getStoreImpl as any), null);
  });

  it("pickFromBlob returns the winner merged with the domain, same shape as the old service", () => {
    const out = pickFromBlob(blob(), { host: "example.com", language: "en" });
    assert.equal(out.id, "l1");
    assert.equal(out.html, "<h1>hi</h1>");
    assert.deepEqual(out.domain, { id: "d1", name: "example.com", googleAnalyticsId: "G-1" });
  });

  it("pickFromBlob honours route and percent via pickLander", () => {
    const b = blob([lander({ id: "home" }), lander({ id: "promo", route: "promo" })]);
    assert.equal(pickFromBlob(b, { host: "example.com", language: "en", route: "promo" }).id, "promo");
    assert.equal(pickFromBlob(b, { host: "example.com", language: "en" }).id, "home");
  });

  it("pickFromBlob returns only the domain when there is no blob or no eligible lander", () => {
    const none = pickFromBlob(null, { host: "example.com", language: "en" });
    assert.deepEqual(none, { domain: { name: "example.com" } });
    const zero = pickFromBlob(blob([lander({ percent: 0 })]), { host: "example.com", language: "en" });
    assert.equal(zero.id, undefined);
    assert.equal(zero.domain.name, "example.com");
  });
});

describe("shouldUseDevApi", () => {
  it("asks the local lander API in development without blob credentials", () => {
    assert.equal(shouldUseDevApi({ NEXT_PUBLIC_NODE_ENV: "development" } as any), true);
  });

  it("uses the real blob in development when site id + token are set", () => {
    assert.equal(
      shouldUseDevApi({
        NEXT_PUBLIC_NODE_ENV: "development",
        NETLIFY_SITE_ID: "s",
        NETLIFY_BLOBS_TOKEN: "t",
      } as any),
      false,
    );
  });

  it("never takes the dev path outside development", () => {
    assert.equal(shouldUseDevApi({ NEXT_PUBLIC_NODE_ENV: "production" } as any), false);
    assert.equal(shouldUseDevApi({} as any), false);
  });
});

describe("readLanderBlobFromDevApi", () => {
  it("fetches the blob for the host from the local lander API", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(blob()));
    }) as unknown as typeof fetch;
    assert.deepEqual(await readLanderBlobFromDevApi("localhost:8181", fetchImpl), blob());
    assert.deepEqual(urls, [
      `${LANDER_API_DEV_ORIGIN}/dev/lander-blob?host=localhost%3A8181`,
    ]);
  });

  it("returns null when the dev database has no landers for the host", async () => {
    const fetchImpl = (async () => new Response("null")) as unknown as typeof fetch;
    assert.equal(await readLanderBlobFromDevApi("nope", fetchImpl), null);
  });

  it("explains how to start the API when it is down or the route is disabled", async () => {
    const down = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await assert.rejects(readLanderBlobFromDevApi("h", down), /DEV_LANDER_BLOB=1/);
    const disabled = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
    await assert.rejects(readLanderBlobFromDevApi("h", disabled), /answered 404/);
  });

  it("reports an unknown domain the way the old dev path did", async () => {
    const unknown = (async () =>
      new Response(JSON.stringify({ success: false, errors: ["DOMAIN_UNKNOWN"] }), {
        status: 404,
      })) as unknown as typeof fetch;
    await assert.rejects(readLanderBlobFromDevApi("h", unknown), /doesn't exist in our system/);
  });
});
