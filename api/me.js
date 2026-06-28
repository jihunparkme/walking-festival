import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookieToken(cookieHeader) {
  const match = (cookieHeader ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("wf_token="));
  return match ? match.slice("wf_token=".length) : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = parseCookieToken(req.headers.cookie);
  if (!token) {
    return res.status(401).json({ error: "인증이 필요합니다." });
  }

  const { data: participant, error } = await supabase
    .from("participants")
    .select("id, name")
    .eq("token", token)
    .maybeSingle();

  if (error || !participant) {
    return res.status(401).json({ error: "유효하지 않은 세션입니다." });
  }

  return res.status(200).json({
    name: participant.name,
    lotteryNumber: String(participant.id).padStart(6, "0"),
  });
}
