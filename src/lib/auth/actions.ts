"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { migrateGuestToUser } from "@/lib/session/guest";

import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { authThrottle } from "./throttle";
import { flattenFieldErrors, loginSchema, signupSchema, type AuthFormState } from "./validation";

/** Only allow same-origin, absolute-path redirects. */
function safeRedirectTarget(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function signupAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rawName = formData.get("name");
  const rawEmail = formData.get("email");
  const parsed = signupSchema.safeParse({
    name: rawName,
    email: rawEmail,
    password: formData.get("password"),
  });

  const values = {
    name: typeof rawName === "string" ? rawName : "",
    email: typeof rawEmail === "string" ? rawEmail : "",
  };

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenFieldErrors(parsed.error),
      values,
    };
  }

  const throttle = await authThrottle("signup", parsed.data.email);
  if (!throttle.allowed) {
    return {
      status: "error",
      message: `Too many sign-up attempts. Try again in ${throttle.retryAfterMinutes} minute(s).`,
      values,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return {
      status: "error",
      message: "An account with that email already exists.",
      errors: { email: ["An account with that email already exists."] },
      values,
    };
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await createSession(user.id);
  await migrateGuestToUser(user.id).catch(() => 0);
  revalidatePath("/", "layout");
  redirect(safeRedirectTarget(formData.get("next")));
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rawEmail = formData.get("email");
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
  });

  const values = { email: typeof rawEmail === "string" ? rawEmail : "" };

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenFieldErrors(parsed.error),
      values,
    };
  }

  const throttle = await authThrottle("login", parsed.data.email);
  if (!throttle.allowed) {
    return {
      status: "error",
      message: `Too many sign-in attempts. Try again in ${throttle.retryAfterMinutes} minute(s).`,
      values,
    };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const invalid: AuthFormState = {
    status: "error",
    message: "Incorrect email or password.",
    errors: { password: ["Incorrect email or password."] },
    values,
  };

  if (!user) return invalid;

  const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordMatches) return invalid;

  if (user.isBanned) {
    return { status: "error", message: "This account has been suspended.", values };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  await migrateGuestToUser(user.id).catch(() => 0);
  revalidatePath("/", "layout");
  redirect(safeRedirectTarget(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
