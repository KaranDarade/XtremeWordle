import { describe, expect, it } from "vitest";

import { buildQuery } from "@/lib/admin/url";
import { asString, readJsonObject } from "@/lib/http/json";
import { cn } from "@/lib/utils";

function fakeRequest(json: () => Promise<unknown>): Request {
  return { json } as unknown as Request;
}

describe("readJsonObject", () => {
  it("returns a plain object body", async () => {
    const body = await readJsonObject(fakeRequest(async () => ({ mode: "DAILY" })));
    expect(body).toEqual({ mode: "DAILY" });
  });

  it("returns an empty object for arrays", async () => {
    expect(await readJsonObject(fakeRequest(async () => [1, 2, 3]))).toEqual({});
  });

  it("returns an empty object for primitives and null", async () => {
    expect(await readJsonObject(fakeRequest(async () => "text"))).toEqual({});
    expect(await readJsonObject(fakeRequest(async () => 42))).toEqual({});
    expect(await readJsonObject(fakeRequest(async () => null))).toEqual({});
  });

  it("returns an empty object when the body is not valid JSON", async () => {
    const body = await readJsonObject(
      fakeRequest(async () => {
        throw new SyntaxError("Unexpected token");
      }),
    );
    expect(body).toEqual({});
  });
});

describe("asString", () => {
  it("passes through strings and rejects everything else", () => {
    expect(asString("crane")).toBe("crane");
    expect(asString("")).toBe("");
    expect(asString(123)).toBeNull();
    expect(asString(null)).toBeNull();
    expect(asString(undefined)).toBeNull();
    expect(asString({ a: 1 })).toBeNull();
    expect(asString(["a"])).toBeNull();
  });
});

describe("buildQuery", () => {
  it("skips empty values", () => {
    expect(buildQuery({ a: "1", b: "", c: undefined, d: null, e: "2" })).toBe("?a=1&e=2");
  });

  it("returns an empty string when nothing is left", () => {
    expect(buildQuery({ a: undefined, b: "" })).toBe("");
  });

  it("URL-encodes values", () => {
    expect(buildQuery({ q: "two words", page: 2 })).toBe("?q=two+words&page=2");
  });

  it("keeps numeric zero", () => {
    expect(buildQuery({ page: 0 })).toBe("?page=0");
  });
});

describe("cn", () => {
  it("joins class names and resolves Tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", undefined, "font-bold")).toBe("text-sm font-bold");
  });
});
