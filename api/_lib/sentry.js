import * as Sentry from "@sentry/node";

let initialized = false;

/** 서버(Serverless Function) Sentry 초기화 — DSN이 없으면 조용히 건너뜀 */
function initSentry() {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.2,
  });
}

/**
 * Vercel Serverless Function 핸들러를 감싸 처리되지 않은 예외를 Sentry로 전송한다.
 * 각 핸들러 내부에서 이미 처리한 에러(4xx/5xx 응답)는 그대로 두고,
 * throw 된 예외만 캡처 후 500 응답으로 정리한다.
 */
export function withSentry(handler) {
  return async function wrappedHandler(req, res) {
    initSentry();
    try {
      return await handler(req, res);
    } catch (error) {
      Sentry.captureException(error);
      await Sentry.flush(2000);
      if (!res.headersSent) {
        res.status(500).json({ error: "서버 오류가 발생했습니다." });
      }
    }
  };
}
