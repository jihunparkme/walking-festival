import { createClient } from "@supabase/supabase-js";
import { withSentry } from "../_lib/sentry.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "walking-festival";

// 서명된 URL의 유효 시간 (초) — 관리자 화면 노출 동안만 유효하면 충분
const SIGNED_URL_EXPIRES_IN = 60 * 10;

function checkAdmin(req, res) {
  const password = req.headers["x-admin-password"];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return false;
  }
  return true;
}

export default withSentry(async function handler(req, res) {
  if (!checkAdmin(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "id는 필수입니다." });
  }

  const { data: participant, error } = await supabase
    .from("participants")
    .select("finish_photo_path, is_finish_completed")
    .eq("id", id)
    .maybeSingle();

  if (error || !participant || !participant.is_finish_completed) {
    return res.status(404).json({ error: "완주자를 찾을 수 없습니다." });
  }

  if (!participant.finish_photo_path) {
    return res.status(404).json({ error: "등록된 완주 사진이 없습니다." });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(participant.finish_photo_path, SIGNED_URL_EXPIRES_IN);

  if (signError || !signed) {
    console.error("finisher photo signed url error:", signError);
    return res.status(500).json({ error: "사진을 불러오는 중 오류가 발생했습니다." });
  }

  return res.status(200).json({ url: signed.signedUrl });
});
