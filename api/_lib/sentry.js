import * as Sentry from "@sentry/node";

let initialized = false;

// 국내 휴대폰 번호 패턴 (하이픈 유무 무관) — 에러 메시지 등에 섞여 들어온 값을 마스킹
const PHONE_PATTERN = /01[016789]-?\d{3,4}-?\d{4}/g;
// 참가자 세션 쿠키 값(토큰)이 텍스트에 그대로 노출되지 않도록 마스킹
const TOKEN_COOKIE_PATTERN = /(wf_token=)[^;\s]+/g;
// Sentry 이벤트에서 통째로 제거할 민감 필드 키 (요청/쿠키/헤더 등)
const SENSITIVE_KEYS = ["cookies", "cookie", "phone", "wf_token", "password"];

/** 문자열 내 전화번호/토큰 등 민감정보를 마스킹한다. */
function scrubText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(PHONE_PATTERN, "***-****-****")
    .replace(TOKEN_COOKIE_PATTERN, "$1***");
}

/** 객체를 순회하며 민감 필드는 제거하고, 문자열 값은 마스킹한다. */
function scrubObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (typeof val === "string") {
      obj[key] = scrubText(val);
    } else if (val && typeof val === "object") {
      scrubObject(val);
    }
  }
  return obj;
}

/**
 * Sentry로 전송되기 직전 이벤트에서 참가자 이름/전화번호, 세션 쿠키(wf_token) 등
 * 개인정보(PII)를 마스킹/제거한다. (요청 데이터, 예외 메시지, breadcrumb 전반)
 */
function beforeSend(event) {
  scrubObject(event.request);
  scrubObject(event.extra);
  event.breadcrumbs?.forEach((b) => scrubObject(b.data));
  event.exception?.values?.forEach((v) => {
    v.value = scrubText(v.value);
  });
  if (event.message) event.message = scrubText(event.message);
  return event;
}

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
    sendDefaultPii: false,
    beforeSend,
  });
}

/**
 * 예외를 마주한 참가자를 Sentry에서 식별할 수 있도록 id를 요청 객체에 표시해 둔다.
 * 전역 스코프(Sentry.setUser)를 매 요청마다 건드리지 않고, 실제로 예외가 캡처될 때만
 * (withSentry의 catch에서) 격리된 스코프에 연결한다 — 서버리스 warm 인스턴스가 여러
 * 요청을 재사용할 때 참가자 id가 다른 요청의 이벤트에 잘못 섞이는 것을 방지한다.
 * 이름/전화번호 등 PII는 절대 전달하지 않는다 — 필요 시 이 id로 Supabase를 조회해 확인한다.
 */
export function identifyUser(req, participantId) {
  req.__participantId = String(participantId);
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
      Sentry.withScope((scope) => {
        if (req.__participantId) {
          scope.setUser({ id: req.__participantId });
        }
        Sentry.captureException(error);
      });
      await Sentry.flush(2000);
      if (!res.headersSent) {
        res.status(500).json({ error: "서버 오류가 발생했습니다." });
      }
    }
  };
}
