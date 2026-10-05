import * as Sentry from "@sentry/nextjs";

/**
 * Client-side Sentry init. Disabled automatically when no DSN is configured, so
 * local development and the test suite never send events.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
