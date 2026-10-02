"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

import { AVATAR_CATEGORIES, normalizeAvatar } from "./config";

export interface AvatarActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function saveAvatarAction(
  _prevState: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  const user = await requireUser();

  const raw: Record<string, string> = {};
  for (const category of AVATAR_CATEGORIES) {
    const value = formData.get(category.key);
    if (typeof value === "string" && value.length > 0) {
      raw[category.key] = value;
    }
  }

  try {
    const config = normalizeAvatar(raw);
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarConfig: config as unknown as Prisma.InputJsonValue },
    });
  } catch (error) {
    console.error("[avatar] save failed", error);
    return { status: "error", message: "Could not save your avatar. Please try again." };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/avatar");
  revalidatePath("/", "layout");

  return { status: "success", message: "Avatar saved." };
}
