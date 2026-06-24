import { useState } from "react";
import { saveAdminPassword, verifyAdminPassword } from "../lib/admin";

export default function AdminPasswordModal({ open, onSuccess, onClose }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim()) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await verifyAdminPassword(password.trim());
      saveAdminPassword(password.trim());
      setPassword("");
      onSuccess();
    } catch (err) {
      setError(err.message || "비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setPassword("");
    setError("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[#1a2a3a]">관리자 인증</h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#8a9ab5] text-xl font-bold hover:text-[#1a2a3a]"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-[#5f6f88]">관리자 페이지에 접근하려면 비밀번호를 입력해 주세요.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-[#c9d5e5] px-3 py-2.5 text-sm outline-none focus:border-[#ff99bb]"
            placeholder="비밀번호 입력"
            autoFocus
          />
          {error && (
            <p className="rounded-xl bg-[#fff0f4] px-3 py-2 text-xs text-[#d94a70]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#ff99bb] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "확인 중…" : "확인"}
          </button>
        </form>
      </div>
    </div>
  );
}
