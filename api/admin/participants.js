import { createClient } from "@supabase/supabase-js";

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

/** 숫자만 입력했을 때 하이픈 포함 형식으로 변환 */
function formatPhone(s) {
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return null;
}

export default async function handler(req, res) {
  if (!checkAdmin(req, res)) return;

  if (req.method === "GET") {
    const { search = "", page = "1" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const from = (pageNum - 1) * PAGE_SIZE;
    const s = search.trim();

    let query = supabase
      .from("participants")
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (s) {
      const filters = [`name.ilike.%${s}%`, `phone.ilike.%${s}%`];
      const formatted = formatPhone(s);
      if (formatted) filters.push(`phone.ilike.%${formatted}%`);
      query = query.or(filters.join(","));
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("participants fetch error:", error);
      return res.status(500).json({ error: "참여자 정보를 불러오는 중 오류가 발생했습니다." });
    }

    return res.status(200).json({ data, count, page: pageNum, pageSize: PAGE_SIZE });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
