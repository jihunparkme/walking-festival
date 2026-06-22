import { useState } from "react";

export default function LoginModal({ open, onSubmit }) {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});

  if (!open) return null;

  function validate() {
    const next = {};
    if (!name.trim()) next.name = "이름을 입력해 주세요.";
    if (!nickname.trim()) next.nickname = "닉네임을 입력해 주세요.";
    if (!/^01[0-9]{8,9}$/.test(phone.replace(/-/g, "")))
      next.phone = "올바른 전화번호를 입력해 주세요.";
    return next;
  }

  function handleSubmit() {
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSubmit({ name: name.trim(), nickname: nickname.trim(), phone: phone.trim() });
  }

  function handlePhoneChange(e) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setPhone(formatted);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-soft">
        <h3 className="text-lg font-extrabold">참여자 정보 입력</h3>
        <p className="mt-1 text-sm text-[#5f6f88]">
          걷기캠페인 참여를 위해 기본 정보를 입력해 주세요.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#3a4a5c]">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-[#c9d5e5] px-3 py-2 text-sm outline-none focus:border-[#ff99bb]"
              placeholder="실명을 입력해 주세요"
            />
            {errors.name && <p className="mt-1 text-xs text-[#d94a70]">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#3a4a5c]">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-2xl border border-[#c9d5e5] px-3 py-2 text-sm outline-none focus:border-[#ff99bb]"
              placeholder="사용할 닉네임을 입력해 주세요"
            />
            {errors.nickname && <p className="mt-1 text-xs text-[#d94a70]">{errors.nickname}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#3a4a5c]">전화번호</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={handlePhoneChange}
              className="w-full rounded-2xl border border-[#c9d5e5] px-3 py-2 text-sm outline-none focus:border-[#ff99bb]"
              placeholder="010-0000-0000"
            />
            {errors.phone && <p className="mt-1 text-xs text-[#d94a70]">{errors.phone}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="mt-5 w-full rounded-full bg-[#ff99bb] py-2.5 text-sm font-bold text-white"
        >
          참여 시작하기
        </button>
      </div>
    </div>
  );
}
