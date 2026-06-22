import { useState } from "react";

// 입력 단계: 이름/전화번호 작성 + 개인정보 동의
function InputStep({ name, phone, agreed, onChange, onNext }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [errors, setErrors] = useState({});

  function handlePhoneChange(e) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    onChange("phone", formatted);
  }

  function validate() {
    const next = {};
    if (!name.trim()) next.name = "이름을 입력해 주세요.";
    if (!/^01[0-9]{8,9}$/.test(phone.replace(/-/g, "")))
      next.phone = "올바른 전화번호를 입력해 주세요.";
    if (!agreed) next.agreed = "개인정보 수집 및 이용에 동의해 주세요.";
    return next;
  }

  function handleNext() {
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onNext({ name: name.trim(), phone: phone.trim() });
  }

  return (
    <>
      <h3 className="text-lg font-extrabold">참여자 정보 입력</h3>
      <p className="mt-1 text-sm text-[#5f6f88]">
        걷기캠페인 참여를 위해 이름과 전화번호를 입력해 주세요.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-[#3a4a5c]">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onChange("name", e.target.value)}
            className="w-full rounded-2xl border border-[#c9d5e5] px-3 py-2 text-sm outline-none focus:border-[#ff99bb]"
            placeholder="실명을 입력해 주세요"
          />
          {errors.name && <p className="mt-1 text-xs text-[#d94a70]">{errors.name}</p>}
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

        {/* 개인정보 동의 */}
        <div className="rounded-2xl border border-[#c9d5e5] bg-[#f7f9fc] p-3">
          <p className="text-xs font-semibold text-[#3a4a5c]">개인정보 수집 및 이용 동의 (필수)</p>
          <p className="mt-1 text-xs leading-relaxed text-[#5f6f88]">
            수집 항목: 이름, 전화번호 · 수집 목적: 캠페인 참여자 식별 및 추첨 번호 발급
            · 보유 기간: 행사 종료 후 30일 이내 파기
          </p>
          <button
            type="button"
            onClick={() => setPrivacyOpen((v) => !v)}
            className="mt-1 text-xs font-semibold text-[#ff99bb] underline"
          >
            {privacyOpen ? "접기" : "전문 보기"}
          </button>
          {privacyOpen && (
            <p className="mt-2 text-xs leading-relaxed text-[#5f6f88]">
              본 캠페인은 「개인정보 보호법」 제15조에 따라 참여자의 동의를 받아
              개인정보를 수집·이용합니다. 수집된 개인정보는 행사 운영 목적
              이외에 사용되지 않으며, 행사 종료일(2024년 9월 10일)로부터 30일
              이내에 안전하게 파기됩니다. 동의를 거부할 권리가 있으나 거부 시
              캠페인 참여가 제한됩니다.
            </p>
          )}
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => onChange("agreed", e.target.checked)}
              className="h-4 w-4 accent-[#ff99bb]"
            />
            <span className="text-xs font-semibold text-[#3a4a5c]">
              개인정보 수집 및 이용에 동의합니다.
            </span>
          </label>
          {errors.agreed && <p className="mt-1 text-xs text-[#d94a70]">{errors.agreed}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={handleNext}
        className="mt-5 w-full rounded-full bg-[#ff99bb] py-2.5 text-sm font-bold text-white"
      >
        다음
      </button>
    </>
  );
}

// 재확인 단계: 입력 정보 확인 후 최종 제출
function ConfirmStep({ name, phone, loading, error, onConfirm, onBack }) {
  return (
    <>
      <h3 className="text-lg font-extrabold">입력 정보 확인</h3>
      <p className="mt-1 text-sm text-[#5f6f88]">
        아래 정보가 맞는지 다시 한번 확인해 주세요.
      </p>

      <div className="mt-4 rounded-2xl border border-[#c9d5e5] bg-[#f7f9fc] p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-[#3a4a5c]">이름</span>
          <span className="text-[#1a2a3a] font-bold">{name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-[#3a4a5c]">전화번호</span>
          <span className="text-[#1a2a3a] font-bold">{phone}</span>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-[#fff0f4] px-3 py-2 text-xs text-[#d94a70]">{error}</p>
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex-1 rounded-full bg-[#ccd6e4] py-2.5 text-sm font-bold disabled:opacity-50"
        >
          수정하기
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 rounded-full bg-[#ff99bb] py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "처리 중…" : "참여 시작하기"}
        </button>
      </div>
    </>
  );
}

export default function LoginModal({ open, onSubmit }) {
  const [step, setStep] = useState("input"); // "input" | "confirm"
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (!open) return null;

  function handleFieldChange(field, value) {
    if (field === "name") setName(value);
    else if (field === "phone") setPhone(value);
    else if (field === "agreed") setAgreed(value);
  }

  function handleNext(data) {
    setSubmitError("");
    setStep("confirm");
  }

  async function handleConfirm() {
    setLoading(true);
    setSubmitError("");
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim() });
    } catch (err) {
      setSubmitError(err.message || "오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("input");
    setSubmitError("");
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-soft">
        {step === "input" ? (
          <InputStep
            name={name}
            phone={phone}
            agreed={agreed}
            onChange={handleFieldChange}
            onNext={handleNext}
          />
        ) : (
          <ConfirmStep
            name={name.trim()}
            phone={phone.trim()}
            loading={loading}
            error={submitError}
            onConfirm={handleConfirm}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
