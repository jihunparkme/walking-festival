import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// QR 인증 type -> participants 컬럼 매핑
const FIELD_BY_TYPE = {
  turn: "is_turn_completed",
  finish: "is_finish_completed",
};

function parseCookieToken(cookieHeader) {
  const match = (cookieHeader ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("wf_token="));
  return match ? match.slice("wf_token=".length) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = parseCookieToken(req.headers.cookie);
  const { type } = req.body ?? {};

  if (!token) {
    return res.status(401).json({ error: "인증이 필요합니다." });
  }

  const field = FIELD_BY_TYPE[type];
  if (!field) {
    return res.status(400).json({ error: "type은 turn 또는 finish여야 합니다." });
  }

  // token으로 참여자 조회 (해당 체크포인트 완료 여부 함께 조회)
  const { data: participant, error: pError } = await supabase
    .from("participants")
    .select(`id, ${field}`)
    .eq("token", token)
    .maybeSingle();

  if (pError || !participant) {
    return res.status(401).json({ error: "유효하지 않은 세션입니다." });
  }

  if (participant[field]) {
    return res.status(409).json({ error: "이미 인증이 완료되었습니다.", type });
  }

  const { error: updateError } = await supabase
    .from("participants")
    .update({ [field]: true })
    .eq("id", participant.id);

  if (updateError) {
    console.error("checkpoint update error:", updateError);
    return res.status(500).json({ error: "인증 저장 중 오류가 발생했습니다." });
  }

  return res.status(200).json({ success: true, type });
}
