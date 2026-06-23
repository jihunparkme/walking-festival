import { createClient } from "@supabase/supabase-js";

// 서버 사이드에서 service_role 키로 RLS를 우회하여 처리합니다.
// Vercel 환경 변수로 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 설정해야 합니다.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, boothId } = req.body ?? {};

  if (!token || !boothId) {
    return res.status(400).json({ error: "token과 boothId는 필수입니다." });
  }

  // 1. token으로 참여자 조회
  const { data: participant, error: pError } = await supabase
    .from("participants")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  if (pError || !participant) {
    return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }

  // 2. 도장 INSERT — uq_participant_booth 제약이 중복을 막아 409로 처리됩니다.
  const { error: insertError } = await supabase
    .from("stamp_records")
    .insert({ participant_id: participant.id, booth_id: boothId });

  if (insertError) {
    if (insertError.code === "23505") {
      return res.status(409).json({ error: "이미 도장을 받은 부스입니다." });
    }
    console.error("stamp insert error:", insertError);
    return res.status(500).json({ error: "도장 저장 중 오류가 발생했습니다." });
  }

  return res.status(201).json({ success: true, boothId, participantId: participant.id });
}
