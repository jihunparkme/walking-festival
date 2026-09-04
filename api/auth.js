import { createClient } from "@supabase/supabase-js";
import { withSentry, identifyUser } from "./_lib/sentry.js";
import { buildSetCookie } from "./_lib/auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default withSentry(async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, phone } = req.body ?? {};
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: "이름과 전화번호는 필수입니다." });
  }

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();

  // 기존 사용자 조회 (이름 + 전화번호 조합으로 중복 판단 — 보호자가 같은 번호로
  // 여러 자녀를 등록하는 경우를 허용하기 위해 전화번호만으로는 판단하지 않는다)
  const { data: existing, error: fetchError } = await supabase
    .from("participants")
    .select("id, name, token")
    .eq("phone", trimmedPhone)
    .eq("name", trimmedName)
    .maybeSingle();

  if (fetchError) {
    console.error("participants fetch error:", fetchError);
    return res.status(500).json({ error: "서버 조회 중 오류가 발생했습니다." });
  }

  if (existing) {
    identifyUser(req, existing.id);
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
    if (insertError.code === "23505") {
      return res.status(400).json({ error: "이미 동일한 이름과 전화번호로 등록되어 있습니다." });
    }
    console.error("participants insert error:", insertError);
    return res.status(500).json({ error: "참여자 등록 중 오류가 발생했습니다." });
  }

  identifyUser(req, inserted.id);
  res.setHeader("Set-Cookie", buildSetCookie(inserted.token));
  return res.status(201).json({
    isNew: true,
    lotteryNumber: String(inserted.id).padStart(6, "0"),
  });
});
