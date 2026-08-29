import { createClient } from "@supabase/supabase-js";
import { withSentry } from "./_lib/sentry.js";
import { validateStampRequest } from "./_lib/qrSign.js";
import { assertTokenPresent, fetchParticipantByToken } from "./_lib/auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default withSentry(async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { boothId, sig } = req.body ?? {};

  // 기존 응답 순서(토큰 누락 401 > 서명 검증 오류) 유지를 위해 토큰 존재 여부만 먼저 확인
  const token = assertTokenPresent(req, res);
  if (!token) return;

  const validation = validateStampRequest(boothId, sig, process.env.QR_SECRET);
  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.error });
  }

  // 이미 확보한 token 재사용
  const participant = await fetchParticipantByToken(req, res, token, supabase, "id");
  if (!participant) return;

  // 도장 INSERT — uq_participant_booth 제약이 중복을 막아 409로 처리됩니다.
  const { error: insertError } = await supabase
    .from("stamp_records")
    .insert({ participant_id: participant.id, booth_id: boothId });

  if (insertError) {
    if (insertError.code === "23505") {
      return res.status(409).json({ error: "이미 도장을 받은 부스입니다.", boothId });
    }
    console.error("stamp insert error:", insertError);
    return res.status(500).json({ error: "도장 저장 중 오류가 발생했습니다." });
  }

  return res.status(201).json({ success: true, boothId });
});
