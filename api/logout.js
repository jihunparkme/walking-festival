import { withSentry } from "./_lib/sentry.js";
import { buildClearCookie } from "./_lib/auth.js";

export default withSentry(function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", buildClearCookie());
  return res.status(200).json({ ok: true });
});
