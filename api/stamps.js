import { createClient } from "@supabase/supabase-js";
import { withSentry } from "./_lib/sentry.js";
import { requireParticipant } from "./_lib/auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default withSentry(async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const participant = await requireParticipant(req, res, supabase, "id");
  if (!participant) return;

  const { data, error } = await supabase
    .from("stamp_records")
    .select("booth_id")
    .eq("participant_id", participant.id);

  if (error) {
    console.error("stamp_records fetch error:", error);
    return res.status(500).json({ error: "도장 정보를 불러오는 중 오류가 발생했습니다." });
  }

  const stamps = (data ?? []).reduce((acc, r) => ({ ...acc, [r.booth_id]: true }), {});
  return res.status(200).json({ stamps });
});
