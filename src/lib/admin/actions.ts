"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, revokeAllSessions } from "@/lib/auth/session";
import { authThrottle } from "@/lib/auth/throttle";
import { prisma } from "@/lib/db";
import { flattenFieldErrors, loginSchema, type AuthFormState } from "@/lib/auth/validation";
import { parseGameSettings, assignManualPuzzle, regeneratePuzzle } from "@/lib/words/resolver";

import { logAdminAction } from "./audit";
import type { AdminActionState } from "./types";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/users");
  revalidatePath("/admin/games");
  revalidatePath("/admin/words");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/audit");
}

function safeTarget(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

// ------------------------------- Auth -------------------------------

export async function adminLoginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rawEmail = formData.get("email");
  const parsed = loginSchema.safeParse({ email: rawEmail, password: formData.get("password") });
  const values = { email: typeof rawEmail === "string" ? rawEmail : "" };

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenFieldErrors(parsed.error),
      values,
    };
  }

  const throttle = await authThrottle("admin-login", parsed.data.email);
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

  const matches = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!matches) return invalid;

  if (user.role !== "ADMIN") {
    return {
      status: "error",
      message: "This account does not have admin access.",
      values,
    };
  }

  if (user.isBanned) {
    return { status: "error", message: "This account has been suspended.", values };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  await logAdminAction({
    adminId: user.id,
    action: "admin.login",
    targetType: "User",
    targetId: user.id,
  });
  revalidatePath("/", "layout");
  redirect(safeTarget(formData.get("next"), "/admin"));
}

// ------------------------------- Word scheduling -------------------------------

export async function assignWordAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const slug = String(formData.get("gameSlug") ?? "");
  const mode = formData.get("mode") === "twelve-hour" ? "twelve-hour" : "daily";
  const date = String(formData.get("date") ?? "").trim();
  const half = formData.get("half") === "12" ? "12" : "00";
  const rawWord = String(formData.get("word") ?? "")
    .trim()
    .toLowerCase();

  const game = await prisma.game.findUnique({ where: { slug } });
  if (!game) return { status: "error", message: "That game does not exist." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: "error", message: "Pick a valid date." };
  }
  if (!/^[a-z]+$/.test(rawWord)) {
    return { status: "error", message: "The word must contain letters only." };
  }

  const settings = parseGameSettings(game.settings);
  if (settings.resolver !== "word") {
    return {
      status: "error",
      message: "Manual word assignment is only available for word games. Use regenerate instead.",
    };
  }

  const expectedLength = settings.answerLength;
  if (expectedLength && rawWord.length !== expectedLength) {
    return { status: "error", message: `The word must be exactly ${expectedLength} letters.` };
  }

  const known = await prisma.wordEntry.findFirst({
    where: { gameId: game.id, normalized: rawWord },
    select: { id: true },
  });
  if (!known) {
    return {
      status: "error",
      message: `"${rawWord}" is not in this game's word list, so the puzzle would be unsolvable.`,
    };
  }

  const bucketKey = mode === "twelve-hour" ? `${date}-${half}` : date;
  await assignManualPuzzle(game.id, bucketKey, rawWord, admin.id);
  await logAdminAction({
    adminId: admin.id,
    action: "word.assign",
    targetType: "DailyPuzzle",
    targetId: `${game.slug}:${bucketKey}`,
    meta: { slug: game.slug, bucketKey, word: rawWord },
  });

  revalidateAdmin();
  return { status: "success", message: `Set "${rawWord}" for ${game.name} on ${bucketKey}.` };
}

export async function regenerateWordAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const slug = String(formData.get("gameSlug") ?? "");
  const bucketKey = String(formData.get("bucketKey") ?? "").trim();
  const force = formData.get("force") === "true";

  const game = await prisma.game.findUnique({ where: { slug } });
  if (!game) return { status: "error", message: "That game does not exist." };
  if (!bucketKey) return { status: "error", message: "Missing slot." };

  const result = await regeneratePuzzle(game, bucketKey, { force });
  if (result.skipped) {
    return { status: "error", message: result.reason ?? "Nothing to regenerate." };
  }

  await logAdminAction({
    adminId: admin.id,
    action: force ? "word.forceRegenerate" : "word.regenerate",
    targetType: "DailyPuzzle",
    targetId: `${game.slug}:${bucketKey}`,
    meta: { slug: game.slug, bucketKey, word: result.puzzle?.word ?? null, force },
  });

  revalidateAdmin();
  return { status: "success", message: `Regenerated ${bucketKey} → "${result.puzzle?.word}".` };
}

// ------------------------------- Games -------------------------------

export async function toggleGameActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) return;

  const updated = await prisma.game.update({ where: { id }, data: { isActive: !game.isActive } });
  await logAdminAction({
    adminId: admin.id,
    action: "game.toggleActive",
    targetType: "Game",
    targetId: id,
    meta: { slug: game.slug, isActive: updated.isActive },
  });
  revalidateAdmin();
}

export async function updateGameAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!id) return { status: "error", message: "Missing game." };
  if (name.length < 2) return { status: "error", message: "Name must be at least 2 characters." };
  if (!Number.isFinite(sortOrder))
    return { status: "error", message: "Sort order must be a number." };

  await prisma.game.update({
    where: { id },
    data: { name, tagline: tagline || null, description: description || null, sortOrder },
  });
  await logAdminAction({
    adminId: admin.id,
    action: "game.update",
    targetType: "Game",
    targetId: id,
    meta: { name, sortOrder },
  });
  revalidateAdmin();
  return { status: "success", message: `Saved ${name}.` };
}

// ------------------------------- Users -------------------------------

export async function toggleUserBanAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.id === admin.id) return;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: !user.isBanned },
  });
  if (updated.isBanned) {
    await revokeAllSessions(userId);
  }
  await logAdminAction({
    adminId: admin.id,
    action: updated.isBanned ? "user.ban" : "user.unban",
    targetType: "User",
    targetId: userId,
    meta: { email: user.email },
  });
  revalidateAdmin();
}

export async function resetUserPasswordAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      status: "error",
      message: "Password must be at least 8 characters with a letter and a number.",
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { status: "error", message: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  await revokeAllSessions(userId);
  await logAdminAction({
    adminId: admin.id,
    action: "user.resetPassword",
    targetType: "User",
    targetId: userId,
    meta: { email: user.email },
  });
  revalidateAdmin();
  return { status: "success", message: "Password reset and all sessions revoked." };
}

export async function revokeSessionsAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  await revokeAllSessions(userId);
  await logAdminAction({
    adminId: admin.id,
    action: "user.revokeSessions",
    targetType: "User",
    targetId: userId,
  });
  revalidateAdmin();
}

// ------------------------------- Words: CSV import -------------------------------

export async function importWordsAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const gameId = String(formData.get("gameId") ?? "");
  const pool = formData.get("pool") === "ANSWERS";
  const raw = String(formData.get("csv") ?? "");

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return { status: "error", message: "Choose a game first." };

  const words = [
    ...new Set(
      raw
        .split(/[\s,;\r\n]+/)
        .map((word) => word.trim().toLowerCase())
        .filter((word) => /^[a-z]{2,}$/.test(word)),
    ),
  ];

  if (words.length === 0) {
    return { status: "error", message: "No valid words found in that input." };
  }

  const chunkSize = 2000;
  let inserted = 0;
  for (let i = 0; i < words.length; i += chunkSize) {
    const batch = words.slice(i, i + chunkSize).map((word) => ({
      gameId,
      word,
      normalized: word,
      length: word.length,
      isAnswerPool: pool,
      isActive: true,
      tags: [pool ? "answer" : "imported"],
    }));
    const result = await prisma.wordEntry.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }

  await logAdminAction({
    adminId: admin.id,
    action: "word.import",
    targetType: "Game",
    targetId: gameId,
    meta: { slug: game.slug, submitted: words.length, inserted, pool },
  });
  revalidateAdmin();
  return {
    status: "success",
    message: `Imported ${inserted} new words (${words.length} submitted).`,
  };
}
