export default function PasswordModal({
  open,
  value,
  error,
  onChange,
  onCancel,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-soft">
        <h3 className="text-lg font-bold">관리자 확인</h3>
        <p className="mt-1 text-sm text-[#5f6f88]">도장을 찍으려면 관리자 비밀번호를 입력해 주세요.</p>
        <input
          type="password"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-3 w-full rounded-2xl border border-[#c9d5e5] px-3 py-2"
          placeholder="비밀번호 입력"
        />
        {error && <p className="mt-2 text-sm text-[#d94a70]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-[#ccd6e4] px-4 py-2 text-sm font-bold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="flex-1 rounded-full bg-[#ff99bb] px-4 py-2 text-sm font-bold text-white"
          >
            도장 찍기
          </button>
        </div>
      </div>
    </div>
  );
}
