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

  const participant = await requireParticipant(
    req,
    res,
    supabase,
    "id, name, is_turn_completed, is_finish_completed, finish_photo_path"
  );
  if (!participant) return;

  return res.status(200).json({
    name: participant.name,
    lotteryNumber: String(participant.id).padStart(6, "0"),
    isTurnCompleted: participant.is_turn_completed,
    isFinishCompleted: participant.is_finish_completed,
    hasFinishPhoto: Boolean(participant.finish_photo_path),
  });
});
