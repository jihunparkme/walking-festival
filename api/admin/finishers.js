import { createClient } from "@supabase/supabase-js";
import { withSentry } from "../_lib/sentry.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PAGE_SIZE = 20;

function checkAdmin(req, res) {
  const password = req.headers["x-admin-password"];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return false;
  }
  return true;
}

/** PostgREST .or() 필터에서 특수문자 이스케이프 */
function escapeFilter(s) {
  return s.replace(/[%(),]/g, "");
}
function formatPhone(s) {
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return null;
}

export default withSentry(async function handler(req, res) {
  if (!checkAdmin(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { search = "", page = "1" } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const from = (pageNum - 1) * PAGE_SIZE;
  const s = search.trim();

  // 완보자만 조회 — finish_photo_path는 private 버킷 경로이므로 목록에서는
  // has_photo(boolean)로만 노출하고, 실제 사진은 /api/admin/finisher-photo에서
  // 서명된 URL로 별도 발급한다.
  let query = supabase
    .from("participants")
    .select("id, name, phone, finish_photo_path", { count: "exact" })
    .eq("is_finish_completed", true)
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (s) {
    const safe = escapeFilter(s);
    const filters = [`name.ilike.%${safe}%`, `phone.ilike.%${safe}%`];
    const formatted = formatPhone(s);
    if (formatted) filters.push(`phone.ilike.%${formatted}%`);
    query = query.or(filters.join(","));
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("finishers fetch error:", error);
    return res.status(500).json({ error: "완보자 정보를 불러오는 중 오류가 발생했습니다." });
  }

  const finishers = (data ?? []).map(({ finish_photo_path, ...rest }) => ({
    ...rest,
    has_photo: Boolean(finish_photo_path),
  }));

  return res.status(200).json({ data: finishers, count, page: pageNum, pageSize: PAGE_SIZE });
});
