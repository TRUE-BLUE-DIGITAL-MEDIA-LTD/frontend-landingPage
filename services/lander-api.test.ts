import { describe, expect, it } from "vitest";
import {
  LANDER_API_DEV_ORIGIN,
  LANDER_API_ORIGIN,
  landerApiOrigin,
  newVisitorId,
  resolveVisitor,
  setLegacyVisitorId,
} from "./lander-api";

describe("landerApiOrigin", () => {
  it("uses the local API for local landers and the central one otherwise", () => {
    expect(landerApiOrigin("localhost")).toBe(LANDER_API_DEV_ORIGIN);
    expect(landerApiOrigin("localhost:8181")).toBe(LANDER_API_DEV_ORIGIN);
    expect(landerApiOrigin("127.0.0.1")).toBe(LANDER_API_DEV_ORIGIN);
    expect(landerApiOrigin("partner-site.com")).toBe(LANDER_API_ORIGIN);
    expect(landerApiOrigin("")).toBe(LANDER_API_ORIGIN);
  });
});

describe("resolveVisitor", () => {
  it("mints an id on the first visit and reports returning afterwards", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    const first = resolveVisitor(storage);
    expect(first.isReturning).toBe(false);
    expect(first.visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveVisitor(storage)).toEqual({
      visitorId: first.visitorId,
      isReturning: true,
    });
  });

  it("adopts the id from the old first-party cookie, once, as a returning visitor", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    const legacy = "123e4567-e89b-42d3-a456-426614174000";
    setLegacyVisitorId(legacy);
    expect(resolveVisitor(storage)).toEqual({ visitorId: legacy, isReturning: true });
    setLegacyVisitorId(null);
    expect(resolveVisitor(storage)).toEqual({ visitorId: legacy, isReturning: true });

    setLegacyVisitorId("not-a-uuid");
    expect(resolveVisitor(new Map() as never).visitorId).toBeNull();
    const fresh = new Map<string, string>();
    const out = resolveVisitor({
      getItem: (k) => fresh.get(k) ?? null,
      setItem: (k, v) => void fresh.set(k, v),
    });
    expect(out.isReturning).toBe(false);
    setLegacyVisitorId(null);
  });

  it("mints a v4 uuid even without crypto.randomUUID", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      expect(newVisitorId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });

  it("replaces a foreign value stored under the same key", () => {
    const data = new Map<string, string>([["oxy_vid", "something-else"]]);
    const out = resolveVisitor({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
    });
    expect(out.isReturning).toBe(false);
    expect(out.visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.get("oxy_vid")).toBe(out.visitorId);
  });

  it("keeps a cookie-known visitor returning when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => undefined,
    };
    const legacy = "123e4567-e89b-42d3-a456-426614174000";
    setLegacyVisitorId(legacy);
    expect(resolveVisitor(blocked)).toEqual({ visitorId: legacy, isReturning: true });
    setLegacyVisitorId(null);
  });

  it("degrades to an anonymous new visitor when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => undefined,
    };
    expect(resolveVisitor(blocked)).toEqual({
      visitorId: null,
      isReturning: false,
    });
  });
});
