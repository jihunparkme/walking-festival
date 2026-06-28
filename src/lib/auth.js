/**
 * 등록 또는 로그인 — 서버 API를 호출하고 HttpOnly 쿠키를 발급받습니다.
 * 클라이언트는 토큰을 직접 다루지 않습니다.
 * @returns {{ isNew: boolean, lotteryNumber: string }}
 */
export async function registerOrLogin(name, phone) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || "등록/로그인 중 오류가 발생했습니다.");
  }

  return { isNew: json.isNew, lotteryNumber: json.lotteryNumber };
}

/**
 * HttpOnly 쿠키 세션을 서버에서 검증하고 참여자 정보를 반환합니다.
 * @returns {{ name: string, lotteryNumber: string } | null}
 */
export async function fetchMe() {
  const res = await fetch("/api/me");
  if (!res.ok) return null;
  return res.json().catch(() => null);
}
