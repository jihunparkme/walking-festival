import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";

  if (!token) {
    return res.status(401).json({ error: "토큰이 필요합니다." });
  }

  // 토큰으로 참여자 조회
  const { data: participant, error: pError } = await supabase
    .from("participants")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  if (pError || !participant) {
    return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }

  // 해당 참여자의 도장 목록 조회
  const { data, error } = await supabase
    .from("stamp_records")
    .select("booth_id")
    .eq("participant_id", participant.id);

  if (error) {
    console.error("stamp_records fetch error:", error);
    return res.status(500).json({ error: "도장 정보를 불러오는 중 오류가 발생했습니다." });
  }

  const stamps = data.reduce((acc, r) => ({ ...acc, [r.booth_id]: true }), {});
  return res.status(200).json({ stamps });
}
