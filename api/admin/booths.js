import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function checkAdmin(req, res) {
  const password = req.headers["x-admin-password"];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!checkAdmin(req, res)) return;

  // GET: 부스 목록 + 참여 인원 수
  if (req.method === "GET") {
    const { data: boothsData, error: boothsError } = await supabase
      .from("booths")
      .select("*")
      .order("id", { ascending: true });

    if (boothsError) {
      console.error("booths fetch error:", boothsError);
      return res.status(500).json({ error: "부스 정보를 불러오는 중 오류가 발생했습니다." });
    }

    // booth_id별 도장 수 집계
    const { data: stampData, error: stampError } = await supabase
      .from("stamp_records")
      .select("booth_id");

    if (stampError) {
      console.error("stamp_records fetch error:", stampError);
    }

    const countMap = (stampData ?? []).reduce((acc, r) => {
      acc[r.booth_id] = (acc[r.booth_id] ?? 0) + 1;
      return acc;
    }, {});

    const booths = boothsData.map((b) => ({
      ...b,
      participant_count: countMap[b.booth_id] ?? 0,
    }));

    return res.status(200).json({ data: booths });
  }

  // POST: 부스 추가
  if (req.method === "POST") {
    const { booth_id, title, subtitle } = req.body ?? {};
    if (!booth_id || !title) {
      return res.status(400).json({ error: "booth_id와 title은 필수입니다." });
    }

    const { data, error } = await supabase
      .from("booths")
      .insert({ booth_id, title, subtitle: subtitle ?? "" })
      .select()
      .single();

    if (error) {
      console.error("booth insert error:", error);
      return res.status(500).json({ error: "부스 추가 중 오류가 발생했습니다." });
    }

    return res.status(201).json({ data });
  }

  // PATCH: 부스 수정
  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id는 필수입니다." });

    const { booth_id, title, subtitle } = req.body ?? {};
    const updates = {};
    if (booth_id !== undefined) updates.booth_id = booth_id;
    if (title !== undefined) updates.title = title;
    if (subtitle !== undefined) updates.subtitle = subtitle;

    const { data, error } = await supabase
      .from("booths")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("booth update error:", error);
      return res.status(500).json({ error: "부스 수정 중 오류가 발생했습니다." });
    }

    return res.status(200).json({ data });
  }

  // DELETE: 부스 삭제
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id는 필수입니다." });

    const { error } = await supabase.from("booths").delete().eq("id", id);

    if (error) {
      console.error("booth delete error:", error);
      return res.status(500).json({ error: "부스 삭제 중 오류가 발생했습니다." });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
