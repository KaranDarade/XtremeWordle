export const CONSENT_COOKIE = "ew_consent";
export const CONSENT_VERSION = "1";

export type ConsentChoice = "all" | "essential";

export function consentCookieValue(choice: ConsentChoice): string {
  return `${CONSENT_VERSION}:${choice}`;
}
