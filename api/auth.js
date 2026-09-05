import { createClient } from "@supabase/supabase-js";
import { withSentry, identifyUser } from "./_lib/sentry.js";
import { buildSetCookie } from "./_lib/auth.js";
import { isRateLimited } from "./_lib/rateLimit.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default withSentry(async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, phone, mode } = req.body ?? {};
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: "이름과 전화번호는 필수입니다." });
  }
  if (mode !== "register" && mode !== "login") {
    return res.status(400).json({ error: "잘못된 요청입니다." });
  }

  // 아직 세션 토큰이 없는 단계이므로 IP 기준으로 등록/로그인 시도 폭주(전화번호 대입 등) 방지
  if (isRateLimited(req, res, "auth", null, { windowMs: 60_000, maxRequests: 10 })) return;

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();

  // 이름 + 전화번호 조합으로 기존 참여자 여부 판단 (보호자가 같은 번호로 여러
  // 자녀를 등록하는 경우를 허용하기 위해 전화번호만으로는 판단하지 않는다)
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

  // 기존 참여자 로그인: 이름+전화번호 조합이 존재해야만 로그인 처리
  if (mode === "login") {
    if (!existing) {
      return res.status(404).json({ error: "등록된 참여자 정보를 찾을 수 없습니다. 신규 참여를 이용해 주세요." });
    }
    identifyUser(req, existing.id);
    res.setHeader("Set-Cookie", buildSetCookie(existing.token));
    return res.status(200).json({
      isNew: false,
      lotteryNumber: String(existing.id).padStart(6, "0"),
    });
  }

  // 신규 참여 등록: 이름+전화번호 조합이 이미 존재하면 등록 거부
  if (existing) {
    return res.status(400).json({ error: "이미 동일한 이름과 전화번호로 등록되어 있습니다." });
  }

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
