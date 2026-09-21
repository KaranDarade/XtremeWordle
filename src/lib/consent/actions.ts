"use server";

import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/dal";
import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  consentCookieValue,
  type ConsentChoice,
} from "@/lib/consent/constants";
import { prisma } from "@/lib/db";
import { getGuestSession } from "@/lib/session/guest";

/**
 * Records the visitor's cookie choice against their account (or guest session)
 * and stores a lightweight preference cookie so the banner stays dismissed.
 */
export async function recordConsentAction(choice: ConsentChoice): Promise<void> {
  const user = await getCurrentUser();
  const guest = user ? null : await getGuestSession();
  const analyticsGranted = choice === "all";

  await prisma.consentRecord.createMany({
    data: [
      {
        userId: user?.id ?? null,
        guestId: guest?.id ?? null,
        type: "ANALYTICS",
        granted: analyticsGranted,
        version: CONSENT_VERSION,
      },
      {
        userId: user?.id ?? null,
        guestId: guest?.id ?? null,
        type: "MARKETING",
        granted: false,
        version: CONSENT_VERSION,
      },
    ],
  });

  const cookieStore = await cookies();
  cookieStore.set(CONSENT_COOKIE, consentCookieValue(choice), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
