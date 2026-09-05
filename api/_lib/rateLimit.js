// 서버리스 인스턴스(warm) 단위의 in-memory sliding-window rate limit.
// Vercel은 인스턴스가 여러 개일 수 있어 완벽한 방어는 아니지만, 동일 웜 인스턴스로
// 재사용되는 짧은 시간 내 연타/재시도 폭주를 막는 최소한의 방어선으로 충분하다.
// key -> 요청 타임스탬프(ms) 배열
const buckets = new Map();

// 웜 인스턴스가 오래 살아있어도 buckets Map이 무한정 커지지 않도록, 일정 주기로
// 만료된(현재 아무 요청도 없는) 버킷을 정리한다. setInterval 대신 요청 처리 중
// lazy하게 스윕하므로 서버리스 환경에서도 안전하다.
const SWEEP_INTERVAL_MS = 5 * 60_000;
// 개별 windowMs보다 넉넉하게 잡아 어떤 라우트의 윈도우보다도 오래된 항목만 정리한다.
const STALE_AFTER_MS = 10 * 60_000;
let lastSweepAt = Date.now();

/** 마지막 요청이 STALE_AFTER_MS보다 오래된 빈 버킷을 Map에서 제거한다. */
function sweepStaleBuckets() {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  for (const [key, timestamps] of buckets) {
    const latest = timestamps[timestamps.length - 1] ?? 0;
    if (now - latest >= STALE_AFTER_MS) buckets.delete(key);
  }
}

// 참고용 문서화: 실제 한도는 withRateLimit 호출부에서 라우트별로 지정한다.
export const DEFAULT_WINDOW_MS = 10_000;
export const DEFAULT_MAX_REQUESTS = 5;

/** 요청 헤더에서 클라이언트 IP를 추출한다 (Vercel의 x-forwarded-for 우선). */
function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

/**
 * rate limit 키를 만든다. 로그인된 요청(token 존재)은 token 기준으로, 그 외에는 IP 기준으로
 * 구분한다 — token 기준이 IP보다 정확하다 (같은 매장 와이파이의 여러 참가자를 한 명으로
 * 오탐하지 않기 위함).
 */
function buildKey(routeName, req, token) {
  const identity = token ? `token:${token}` : `ip:${getClientIp(req)}`;
  return `${routeName}:${identity}`;
}

/**
 * 주어진 key에 대해 windowMs 동안 maxRequests를 초과했는지 검사하고, 초과하지 않았다면
 * 이번 요청을 기록한다. 만료된 타임스탬프는 매 호출마다 lazy하게 정리한다
 * (서버리스 환경에서는 별도 setInterval을 쓰기 어렵고 적합하지도 않다).
 */
function checkAndRecord(key, windowMs, maxRequests) {
  sweepStaleBuckets();
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    buckets.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return true;
}

/**
 * 라우트별 rate limit 초과 여부만 검사한다(응답 전송 없음). token이 있으면 token 기준,
 * 없으면 요청 IP 기준으로 구분한다. Vercel 스타일(res.status/json)과 로컬 개발용
 * Node 스타일(res.statusCode/end) 양쪽에서 공통으로 재사용하기 위해 응답 형식과 분리했다.
 */
export function checkRateLimit(
  req,
  routeName,
  token,
  { windowMs = DEFAULT_WINDOW_MS, maxRequests = DEFAULT_MAX_REQUESTS } = {}
) {
  const key = buildKey(routeName, req, token);
  return !checkAndRecord(key, windowMs, maxRequests);
}

/**
 * (Vercel Serverless Function용) 라우트별 rate limit을 검사한다. 한도를 초과하면 429 응답을
 * 직접 보내고 true를 반환하므로, 호출부는 true면 즉시 return하면 된다.
 */
export function isRateLimited(req, res, routeName, token, options) {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  if (!checkRateLimit(req, routeName, token, options)) return false;

  res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
  res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
  return true;
}

/** 테스트 전용: 모든 rate limit 상태를 초기화한다. */
export function __resetRateLimitForTests() {
  buckets.clear();
}
