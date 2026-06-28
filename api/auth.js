import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COOKIE_NAME = "wf_token";
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // 180일

function buildSetCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
  ].join("; ");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, phone } = req.body ?? {};
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: "이름과 전화번호는 필수입니다." });
  }

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();

  // 기존 사용자 조회
  const { data: existing, error: fetchError } = await supabase
    .from("participants")
    .select("id, name, token")
    .eq("phone", trimmedPhone)
    .maybeSingle();

  if (fetchError) {
    console.error("participants fetch error:", fetchError);
    return res.status(500).json({ error: "서버 조회 중 오류가 발생했습니다." });
  }

  if (existing) {
    if (existing.name !== trimmedName) {
      return res.status(400).json({ error: "입력하신 이름이 기존 등록 정보와 일치하지 않습니다." });
    }
    res.setHeader("Set-Cookie", buildSetCookie(existing.token));
    return res.status(200).json({
      isNew: false,
      lotteryNumber: String(existing.id).padStart(6, "0"),
    });
  }

  // 신규 사용자 등록
  const { data: inserted, error: insertError } = await supabase
    .from("participants")
    .insert({ name: trimmedName, phone: trimmedPhone })
    .select("id, token")
    .single();

  if (insertError) {
    console.error("participants insert error:", insertError);
    return res.status(500).json({ error: "참여자 등록 중 오류가 발생했습니다." });
  }

  res.setHeader("Set-Cookie", buildSetCookie(inserted.token));
  return res.status(201).json({
    isNew: true,
    lotteryNumber: String(inserted.id).padStart(6, "0"),
  });
}
