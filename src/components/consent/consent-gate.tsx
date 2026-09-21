import { cookies } from "next/headers";

import { ConsentBanner } from "@/components/consent/cookie-banner";
import { CONSENT_COOKIE } from "@/lib/consent/constants";

export async function ConsentGate() {
  const cookieStore = await cookies();
  if (cookieStore.get(CONSENT_COOKIE)?.value) return null;
  return <ConsentBanner />;
}
