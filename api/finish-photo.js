import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "walking-festival";

function parseCookieToken(cookieHeader) {
  const match = (cookieHeader ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("wf_token="));
  return match ? match.slice("wf_token=".length) : null;
}

// 파일명에 쓸 수 없는 문자 제거 (이름/전화번호를 파일명 일부로 사용)
function sanitizeForFileName(value) {
  return String(value ?? "").replace(/[^\w가-힣-]/g, "");
}

function extFromContentType(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function isImageContentType(contentType) {
  return typeof contentType === "string" && contentType.startsWith("image/");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = parseCookieToken(req.headers.cookie);
  if (!token) {
    return res.status(401).json({ error: "인증이 필요합니다." });
  }

  const { fileBase64, contentType } = req.body ?? {};
  if (!fileBase64) {
    return res.status(400).json({ error: "사진 데이터가 필요합니다." });
  }
  if (!isImageContentType(contentType)) {
    return res.status(400).json({ error: "이미지 파일만 업로드할 수 있습니다." });
  }

  // 이름/전화번호는 클라이언트 입력을 신뢰하지 않고 서버가 세션으로 직접 조회
  const { data: participant, error: pError } = await supabase
    .from("participants")
    .select("id, name, phone, is_finish_completed")
    .eq("token", token)
    .maybeSingle();

  if (pError || !participant) {
    return res.status(401).json({ error: "유효하지 않은 세션입니다." });
  }

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
}
