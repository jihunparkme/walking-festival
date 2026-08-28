import { identifyUser } from "./sentry.js";

export const COOKIE_NAME = "wf_token";
export const COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // 180일

/** 요청 쿠키(Cookie 헤더)에서 wf_token 값을 추출한다. */
export function parseCookieToken(cookieHeader) {
  const match = (cookieHeader ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`));
  return match ? match.slice(COOKIE_NAME.length + 1) : null;
}

/** 로그인/등록 성공 시 내려줄 Set-Cookie 값을 만든다. */
export function buildSetCookie(token, { secure = true } = {}) {
  return [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
  ].join("; ");
}

/** 로그아웃 시 쿠키를 즉시 만료시키는 Set-Cookie 값을 만든다. */
export function buildClearCookie({ secure = true } = {}) {
  return [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}

/**
 * 쿠키의 token으로 participants를 조회해 세션을 검증하고, 필요한 필드만 반환한다.
 * 인증 실패 시 401 응답을 직접 보내고 null을 반환하므로, 호출부는 null이면 즉시 return하면 된다.
 */
export async function requireParticipant(req, res, supabase, selectFields) {
  const token = parseCookieToken(req.headers.cookie);
  if (!token) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return null;
  }

  const { data: participant, error } = await supabase
    .from("participants")
    .select(selectFields)
    .eq("token", token)
    .maybeSingle();

  if (error || !participant) {
    res.status(401).json({ error: "유효하지 않은 세션입니다." });
    return null;
  }

  identifyUser(req, participant.id);
  return participant;
}
