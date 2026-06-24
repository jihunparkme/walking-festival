export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body ?? {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: "관리자 비밀번호가 설정되지 않았습니다." });
  }

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  return res.status(200).json({ success: true });
}
