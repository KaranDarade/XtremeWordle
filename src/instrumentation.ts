import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation entry point. Registers the server and edge SDKs and
 * forwards request errors (Server Components, Route Handlers, proxy/middleware)
 * to Sentry.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
