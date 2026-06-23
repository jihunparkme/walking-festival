import { useEffect, useRef, useState } from "react";

const STATUS = {
  WAITING: "waiting",     // 토큰 없음 — 로그인 모달 대기 중
  LOADING: "loading",     // API 호출 중
  SUCCESS: "success",     // 도장 획득
  DUPLICATE: "duplicate", // 이미 받은 도장
  ERROR: "error",         // 오류
};

/**
 * QR 코드 스캔 후 도장 적립 처리 결과를 전체 화면 오버레이로 표시합니다.
 *
 * @param {string}   boothId   - URL 쿼리에서 읽은 부스 ID
 * @param {string}   boothTitle - 부스 표시 이름 (없으면 boothId 사용)
 * @param {string}   token     - LocalStorage에서 읽은 참여자 토큰 (null이면 로그인 대기)
 * @param {Function} onDone    - 완료 콜백 ({ status, boothId })
 */
export default function StampScanPage({ boothId, boothTitle, token, onDone }) {
  const [status, setStatus] = useState(token ? STATUS.LOADING : STATUS.WAITING);
  const [errorMsg, setErrorMsg] = useState("");
  const processedRef = useRef(false); // 중복 API 호출 방지

  useEffect(() => {
    if (!token || processedRef.current) return;

    if (!boothId) {
      setStatus(STATUS.ERROR);
      setErrorMsg("유효하지 않은 QR 코드입니다.");
      setTimeout(() => onDone({ status: "error" }), 3000);
      return;
    }

    processedRef.current = true;
    setStatus(STATUS.LOADING);

    fetch("/api/stamp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, boothId }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus(STATUS.SUCCESS);
          setTimeout(() => onDone({ status: "success", boothId }), 2000);
        } else if (res.status === 409) {
          setStatus(STATUS.DUPLICATE);
          setTimeout(() => onDone({ status: "duplicate", boothId }), 2500);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus(STATUS.ERROR);
          setErrorMsg(data.error || "오류가 발생했습니다.");
          setTimeout(() => onDone({ status: "error" }), 3000);
        }
      })
      .catch(() => {
        setStatus(STATUS.ERROR);
        setErrorMsg("네트워크 오류가 발생했습니다.");
        setTimeout(() => onDone({ status: "error" }), 3000);
      });
  }, [token, boothId]); // token이 설정되는 순간(로그인 완료 후) 자동으로 실행

  const displayTitle = boothTitle || boothId;

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-white/95 px-6 text-center backdrop-blur-sm">
      {status === STATUS.WAITING && (
        <>
          <div className="mb-4 text-5xl">📋</div>
          <h2 className="text-xl font-extrabold">참여자 확인 중</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">아래 폼에서 참여자 정보를 입력해 주세요.</p>
          <p className="mt-1 text-xs text-[#8a9ab5]">등록 완료 후 자동으로 도장이 적립됩니다.</p>
        </>
      )}

      {status === STATUS.LOADING && (
        <>
          <div className="mb-4 animate-spin text-5xl">⏳</div>
          <h2 className="text-xl font-extrabold">도장 적립 중…</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">
            <strong>{displayTitle}</strong> 부스 도장을 처리하고 있습니다.
          </p>
        </>
      )}

      {status === STATUS.SUCCESS && (
        <>
          <div className="mb-4 animate-bounce text-6xl">🎉</div>
          <h2 className="text-2xl font-extrabold text-[#d94a70]">도장 획득!</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">
            <strong>{displayTitle}</strong> 부스 도장을 받았습니다.
          </p>
          <p className="mt-5 text-xs text-[#8a9ab5]">잠시 후 도장판으로 이동합니다…</p>
        </>
      )}

      {status === STATUS.DUPLICATE && (
        <>
          <div className="mb-4 text-5xl">✅</div>
          <h2 className="text-xl font-extrabold">이미 받은 도장입니다</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">
            <strong>{displayTitle}</strong> 부스는 이미 방문하셨습니다.
          </p>
          <p className="mt-5 text-xs text-[#8a9ab5]">잠시 후 도장판으로 이동합니다…</p>
        </>
      )}

      {status === STATUS.ERROR && (
        <>
          <div className="mb-4 text-5xl">⚠️</div>
          <h2 className="text-xl font-extrabold">오류가 발생했습니다</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">{errorMsg}</p>
          <p className="mt-5 text-xs text-[#8a9ab5]">잠시 후 홈으로 이동합니다…</p>
        </>
      )}
    </div>
  );
}
