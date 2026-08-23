import * as Sentry from "@sentry/react";

/** 클라이언트(브라우저) Sentry 초기화 — DSN이 없으면 조용히 건너뜀 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}

export { Sentry };
