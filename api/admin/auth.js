import { withSentry } from "../_lib/sentry.js";
import { isRateLimited } from "../_lib/rateLimit.js";

export default withSentry(function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 비밀번호 대입 공격 방지 (IP 기준 1분에 5회)
  if (isRateLimited(req, res, "admin-auth", null, { windowMs: 60_000, maxRequests: 5 })) return;

  const { password } = req.body ?? {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: "관리자 비밀번호가 설정되지 않았습니다." });
  }

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  return res.status(200).json({ success: true });
});
