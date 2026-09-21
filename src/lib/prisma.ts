import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

/**
 * Prisma 7 requires a driver adapter. This factory is used by both the
 * Next.js runtime (see `db.ts`) and by tooling such as `prisma/seed.ts`.
 */
export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL,
) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
