import { supabase } from "./supabase";

/**
 * 참여자의 완료된 도장 목록을 { boothId: true } 형태로 반환합니다.
 * stamp_records 테이블에 anon SELECT 정책이 필요합니다.
 * @param {number} participantId - participants.id
 * @returns {Promise<Record<string, boolean>>}
 */
export async function fetchMyStamps(participantId) {
  if (!participantId) return {};

  const { data, error } = await supabase
    .from("stamp_records")
    .select("booth_id")
    .eq("participant_id", participantId);

  if (error) {
    console.error("도장 조회 오류:", error);
    return {};
  }

  return data.reduce((acc, r) => ({ ...acc, [r.booth_id]: true }), {});
}
