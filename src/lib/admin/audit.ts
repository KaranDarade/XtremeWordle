import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export interface AuditInput {
  adminId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Prisma.InputJsonValue;
}

/** Records an admin mutation so every change is accountable. */
export async function logAdminAction(input: AuditInput): Promise<void> {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");

  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      meta: input.meta ?? {},
      ip: forwarded?.split(",")[0]?.trim() ?? null,
    },
  });
}
