import { describe, expect, it } from "vitest";

import { flattenFieldErrors, loginSchema, signupSchema } from "@/lib/auth/validation";

describe("signupSchema", () => {
  const valid = { name: "Karan Darade", email: "Player@Example.com", password: "Passw0rd" };

  it("accepts a valid payload and normalises the email", () => {
    const result = signupSchema.parse(valid);
    expect(result.name).toBe("Karan Darade");
    expect(result.email).toBe("player@example.com");
  });

  it("trims surrounding whitespace", () => {
    const result = signupSchema.parse({ ...valid, name: "  Karan  ", email: " a@b.co " });
    expect(result.name).toBe("Karan");
    expect(result.email).toBe("a@b.co");
  });

  it("rejects a name that is too short", () => {
    const result = signupSchema.safeParse({ ...valid, name: "K" });
    expect(result.success).toBe(false);
    expect(flattenFieldErrors(result.error!).name?.[0]).toContain("at least 2");
  });

  it("rejects malformed emails", () => {
    for (const email of ["no-at-sign", "a@b", "a b@c.com", ""]) {
      expect(signupSchema.safeParse({ ...valid, email }).success).toBe(false);
    }
  });

  it("requires a password with a letter and a number", () => {
    expect(signupSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "alllettersonly" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "12345678" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "Passw0rd" }).success).toBe(true);
  });

  it("rejects an over-long password", () => {
    expect(signupSchema.safeParse({ ...valid, password: `a1${"x".repeat(80)}` }).success).toBe(
      false,
    );
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "" });
    expect(result.success).toBe(false);
    expect(flattenFieldErrors(result.error!).password?.[0]).toContain("Enter your password");
  });

  it("rejects a malformed email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});

describe("flattenFieldErrors", () => {
  it("groups messages by their first path segment", () => {
    const result = signupSchema.safeParse({ name: "", email: "bad", password: "bad" });
    expect(result.success).toBe(false);

    const errors = flattenFieldErrors(result.error!);
    expect(Object.keys(errors).sort()).toEqual(["email", "name", "password"]);
    expect(errors.name).toHaveLength(1);
    expect(Array.isArray(errors.email)).toBe(true);
  });
});
