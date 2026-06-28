import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  const { boothId } = req.body ?? {};

  if (!token) {
    return res.status(401).json({ error: "인증이 필요합니다." });
  }

  if (!boothId) {
    return res.status(400).json({ error: "boothId는 필수입니다." });
  }

  // token으로 참여자 조회
  const { data: participant, error: pError } = await supabase
    .from("participants")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  if (pError || !participant) {
    return res.status(401).json({ error: "유효하지 않은 세션입니다." });
  }

  // 도장 INSERT — uq_participant_booth 제약이 중복을 막아 409로 처리됩니다.
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

  return res.status(201).json({ success: true, boothId });
}
