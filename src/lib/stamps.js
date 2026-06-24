/**
 * 참여자의 완료된 도장 목록을 { booth_id: true } 형태로 반환합니다.
 * 서버 API를 통해 token으로 조회하므로 participant_id 노출 없음.
 * @param {string} token - 참여자 인증 토큰
 * @returns {Promise<Record<string, boolean>>}
 */
export async function fetchMyStamps(token) {
  if (!token) return {};

  const res = await fetch("/api/stamps", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error("도장 조회 오류:", await res.text());
    return {};
  }

  const { stamps } = await res.json();
  return stamps ?? {};
}
