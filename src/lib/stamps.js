/**
 * 참여자의 완료된 도장 목록을 { booth_id: true } 형태로 반환합니다.
 * HttpOnly 쿠키가 자동으로 전송되므로 별도 인증 헤더 불필요.
 * @returns {Promise<Record<string, boolean>>}
 */
export async function fetchMyStamps() {
  const res = await fetch("/api/stamps");

  if (!res.ok) {
    console.error("도장 조회 오류:", res.status);
    return {};
  }

  const { stamps } = await res.json();
  return stamps ?? {};
}
