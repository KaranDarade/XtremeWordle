import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Uptime probe: reports app + database health. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "up", at: new Date().toISOString() });
  } catch (error) {
    console.error("[health] database check failed", error);
    return NextResponse.json(
      { ok: false, database: "down", at: new Date().toISOString() },
      { status: 503 },
    );
  }
}
