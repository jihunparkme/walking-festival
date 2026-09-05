import { createClient } from "@supabase/supabase-js";
import { withSentry } from "./_lib/sentry.js";
import { assertTokenPresent, fetchParticipantByToken } from "./_lib/auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// QR 인증 type -> participants 컬럼 매핑
const FIELD_BY_TYPE = {
  turn: "is_turn_completed",
  finish: "is_finish_completed",
};

export default withSentry(async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type } = req.body ?? {};

  // 기존 응답 순서(토큰 누락 401 > type 오류 400) 유지를 위해 토큰 존재 여부만 먼저 확인
  const token = assertTokenPresent(req, res);
  if (!token) return;

  const field = FIELD_BY_TYPE[type];
  if (!field) {
    return res.status(400).json({ error: "type은 turn 또는 finish여야 합니다." });
  }

  // 이미 확보한 token 재사용 (해당 체크포인트 완료 여부 + 반환점 완료 여부 + 완주 사진 등록 여부 함께 조회)
  const participant = await fetchParticipantByToken(
    req,
    res,
    token,
    supabase,
    `id, is_turn_completed, finish_photo_path, ${field}`
  );
  if (!participant) return;

  // 완주 인증은 반환점 인증이 먼저 완료되어야 진행 가능
  if (type === "finish" && !participant.is_turn_completed) {
    return res.status(403).json({
      error: "반환점 QR 코드를 먼저 찍은 후 이용해 주세요.",
      code: "TURN_REQUIRED",
    });
  }

  if (participant[field]) {
    // 완주 인증은 이미 완료됐지만 사진을 아직 등록하지 못한 경우(중간 이탈 등)
    // 단순 중복 오류 대신 사진 재등록이 가능하도록 안내한다.
    if (type === "finish" && !participant.finish_photo_path) {
      return res.status(409).json({
        error: "완주 인증은 완료되었지만 사진이 등록되지 않았습니다.",
        type,
        needsPhoto: true,
      });
    }
    return res.status(409).json({ error: "이미 인증이 완료되었습니다.", type });
  }

  // 조회 이후 동시 중복 요청(더블탭, 네트워크 재시도 등)이 함께 통과하는 것을 막기 위해
  // field가 아직 false인 행에 한해서만 UPDATE가 적용되도록 조건을 건다(원자적 체크 앤 셋).
  const { data: updated, error: updateError } = await supabase
    .from("participants")
    .update({ [field]: true })
    .eq("id", participant.id)
    .eq(field, false)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("checkpoint update error:", updateError);
    return res.status(500).json({ error: "인증 저장 중 오류가 발생했습니다." });
  }

  // 앞선 조회 이후 동시 요청이 먼저 UPDATE를 적용해 이미 field가 true가 된 경우
  if (!updated) {
    return res.status(409).json({ error: "이미 인증이 완료되었습니다.", type });
  }

  return res.status(200).json({ success: true, type });
});
