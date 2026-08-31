import { createClient } from "@supabase/supabase-js";
import { withSentry } from "./_lib/sentry.js";
import { assertTokenPresent, fetchParticipantByToken, requireParticipant } from "./_lib/auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "walking-festival";

// 파일명에 쓸 수 없는 문자 제거 (이름/전화번호를 파일명 일부로 사용)
// Supabase Storage 키는 한글 등 비 ASCII 문자를 허용하지 않으므로 ASCII 문자만 남긴다.
function sanitizeForFileName(value) {
  return String(value ?? "").replace(/[^\w-]/g, "");
}

function extFromContentType(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function isImageContentType(contentType) {
  return typeof contentType === "string" && contentType.startsWith("image/");
}

// 서명된 URL의 유효 시간 (초) — 사진 조회 화면 노출 동안만 유효하면 충분
const SIGNED_URL_EXPIRES_IN = 60 * 10;

export default withSentry(async function handler(req, res) {
  if (req.method === "GET") {
    const participant = await requireParticipant(req, res, supabase, "id, finish_photo_path");
    if (!participant) return;

    // 사진 촬영 없이 완주 인증만 완료한 참여자도 있을 수 있는 정상 상태이므로
    // 오류(404)가 아닌 200 + url: null로 응답한다 (브라우저 콘솔에 불필요한
    // 실패 로그가 남는 것도 방지).
    if (!participant.finish_photo_path) {
      return res.status(200).json({ url: null });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(participant.finish_photo_path, SIGNED_URL_EXPIRES_IN);

    if (signError || !signed) {
      console.error("finish photo signed url error:", signError);
      return res.status(500).json({ error: "사진을 불러오는 중 오류가 발생했습니다." });
    }

    return res.status(200).json({ url: signed.signedUrl });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 기존 응답 순서(토큰 누락 401 > 사진 데이터 검증 400) 유지를 위해 토큰 존재 여부만 먼저 확인
  const token = assertTokenPresent(req, res);
  if (!token) return;

  const { fileBase64, contentType } = req.body ?? {};
  if (!fileBase64) {
    return res.status(400).json({ error: "사진 데이터가 필요합니다." });
  }
  if (!isImageContentType(contentType)) {
    return res.status(400).json({ error: "이미지 파일만 업로드할 수 있습니다." });
  }

  // 이름/전화번호는 클라이언트 입력을 신뢰하지 않고 서버가 세션으로 직접 조회 (이미 확보한 token 재사용)
  const participant = await fetchParticipantByToken(
    req,
    res,
    token,
    supabase,
    "id, name, phone, is_finish_completed"
  );
  if (!participant) return;

  if (!participant.is_finish_completed) {
    return res.status(400).json({ error: "완주 인증을 먼저 완료해 주세요." });
  }

  const buffer = Buffer.from(fileBase64.split(",").pop(), "base64");
  const ext = extFromContentType(contentType);
  const fileName = `${sanitizeForFileName(participant.name)}_${sanitizeForFileName(participant.phone)}_${participant.id}.${ext}`;
  const path = `finish-photos/${fileName}`;

  // upsert: 재촬영 시 동일 참여자의 기존 사진을 덮어씀
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: contentType || "image/jpeg", upsert: true });

  if (uploadError) {
    console.error("finish photo upload error:", uploadError);
    return res.status(500).json({ error: "사진 업로드 중 오류가 발생했습니다." });
  }

  const { error: updateError } = await supabase
    .from("participants")
    .update({ finish_photo_path: path })
    .eq("id", participant.id);

  if (updateError) {
    console.error("finish photo path save error:", updateError);
    return res.status(500).json({ error: "사진 정보 저장 중 오류가 발생했습니다." });
  }

  return res.status(200).json({ success: true, path });
});
