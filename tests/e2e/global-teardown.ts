import "dotenv/config";

import { Client } from "pg";

/**
 * Removes accounts created by the E2E suite so repeated runs do not slowly
 * change the shape of the development database (for example, pushing the
 * seeded demo users off the first page of the admin user list).
 *
 * Only `@example.com` accounts are touched — seeded demo accounts use
 * `@demo.local` and real accounts use whatever domain the operator chose.
 *
 * Raw `pg` is used rather than Prisma so teardown has no build-step dependency.
 */
export default async function globalTeardown() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const client = new Client({ connectionString });

  try {
    await client.connect();

    const removedResults = await client.query(
      `DELETE FROM "GameResult"
       WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@example.com')`,
    );
    const removedUsers = await client.query(`DELETE FROM "User" WHERE email LIKE '%@example.com'`);

    // Keep the other high-churn tables tidy too.
    const removedOtps = await client.query(
      `DELETE FROM "PasswordResetOtp" WHERE email LIKE '%@example.com'`,
    );
    await client.query(`DELETE FROM "Presence" WHERE "lastSeenAt" < now() - interval '1 day'`);
    await client.query(`DELETE FROM "ArenaQueue" WHERE "joinedAt" < now() - interval '1 day'`);

    if (removedUsers.rowCount) {
      console.log(
        `[e2e] removed ${removedUsers.rowCount} test account(s), ${removedResults.rowCount ?? 0} result(s), ${removedOtps.rowCount ?? 0} reset code(s)`,
      );
    }
  } catch (error) {
    console.warn("[e2e] teardown skipped:", error);
  } finally {
    await client.end().catch(() => {});
  }
}
