import { useEffect, useRef, useState } from "react";

const STATUS = {
  WAITING: "waiting",     // 토큰 없음 — 로그인 모달 대기 중
  LOADING: "loading",     // API 호출 중
  SUCCESS: "success",     // 인증 완료
  DUPLICATE: "duplicate", // 이미 완료됨
  ERROR: "error",         // 오류
};

// 체크포인트(반환점/완주) 표시 문구
const CHECKPOINT_LABEL = {
  turn: { title: "반환점", verb: "반환점 인증" },
  finish: { title: "완주", verb: "완주 인증" },
};

/**
 * QR 코드 스캔 후 도장 적립 또는 반환점/완주 인증 처리 결과를
 * 전체 화면 오버레이로 표시합니다.
 * 인증은 HttpOnly 쿠키로 자동 처리됩니다.
 *
 * @param {"booth"|"checkpoint"} mode        - "booth": 부스 도장, "checkpoint": 반환점/완주 인증
 * @param {string}   boothId          - (booth 모드) URL 쿼리에서 읽은 부스 ID
 * @param {string}   boothTitle       - (booth 모드) 부스 표시 이름 (없으면 boothId 사용)
 * @param {"turn"|"finish"} checkpointType - (checkpoint 모드) 체크포인트 종류
 * @param {boolean}  isAuthenticated  - 세션 확인 완료 여부
 * @param {Function} onDone           - 완료 콜백 ({ status, mode, boothId, checkpointType })
 */
export default function StampScanPage({
  mode = "booth",
  boothId,
  boothTitle,
  checkpointType,
  isAuthenticated,
  onDone,
}) {
  const [status, setStatus] = useState(isAuthenticated ? STATUS.LOADING : STATUS.WAITING);
  const [errorMsg, setErrorMsg] = useState("");
  const processedRef = useRef(false);

  const isCheckpoint = mode === "checkpoint";
  const checkpointLabel = CHECKPOINT_LABEL[checkpointType];

  useEffect(() => {
    if (!isAuthenticated || processedRef.current) return;

    if (isCheckpoint && !checkpointLabel) {
      setStatus(STATUS.ERROR);
      setErrorMsg("유효하지 않은 QR 코드입니다.");
      setTimeout(() => onDone({ status: "error" }), 3000);
      return;
    }

    if (!isCheckpoint && !boothId) {
      setStatus(STATUS.ERROR);
      setErrorMsg("유효하지 않은 QR 코드입니다.");
      setTimeout(() => onDone({ status: "error" }), 3000);
      return;
    }

    processedRef.current = true;
    setStatus(STATUS.LOADING);

    const url = isCheckpoint ? "/api/checkpoint" : "/api/stamp";
    const body = isCheckpoint ? { type: checkpointType } : { boothId };

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus(STATUS.SUCCESS);
          setTimeout(() => onDone({ status: "success", mode, boothId, checkpointType }), 2000);
        } else if (res.status === 409) {
          setStatus(STATUS.DUPLICATE);
          setTimeout(() => onDone({ status: "duplicate", mode, boothId, checkpointType }), 2500);
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
  }, [isAuthenticated, boothId, checkpointType]);

  const displayTitle = isCheckpoint ? checkpointLabel?.title : (boothTitle || boothId);
  const verbLabel = isCheckpoint ? checkpointLabel?.verb : "도장";

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-white/95 px-6 text-center backdrop-blur-sm">
      {status === STATUS.WAITING && (
        <>
          <div className="mb-4 text-5xl">📋</div>
          <h2 className="text-xl font-extrabold">참여자 확인 중</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">아래 폼에서 참여자 정보를 입력해 주세요.</p>
          <p className="mt-1 text-xs text-[#8a9ab5]">
            등록 완료 후 자동으로 {isCheckpoint ? "인증이" : "도장이"} 적립됩니다.
          </p>
        </>
      )}

      {status === STATUS.LOADING && (
        <>
          <div className="mb-4 animate-spin text-5xl">⏳</div>
          <h2 className="text-xl font-extrabold">{verbLabel} 처리 중…</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">
            <strong>{displayTitle}</strong> {isCheckpoint ? "인증을" : "부스 도장을"} 처리하고 있습니다.
          </p>
        </>
      )}

      {status === STATUS.SUCCESS && (
        <>
          <div className="mb-4 animate-bounce text-6xl">🎉</div>
          <h2 className="text-2xl font-extrabold text-[#1d4ed8]">
            {isCheckpoint ? `${displayTitle} 인증 완료!` : "도장 획득!"}
          </h2>
          <p className="mt-2 text-sm text-[#5b6c84]">
            {isCheckpoint ? (
              <><strong>{displayTitle}</strong> 인증이 완료되었습니다.</>
            ) : (
              <><strong>{displayTitle}</strong> 부스 도장을 받았습니다.</>
            )}
          </p>
          <p className="mt-5 text-xs text-[#8a9ab5]">잠시 후 도장판으로 이동합니다…</p>
        </>
      )}

      {status === STATUS.DUPLICATE && (
        <>
          <div className="mb-4 text-5xl">✅</div>
          <h2 className="text-xl font-extrabold">
            {isCheckpoint ? "이미 인증을 완료했습니다" : "이미 받은 도장입니다"}
          </h2>
          <p className="mt-2 text-sm text-[#5b6c84]">
            {isCheckpoint ? (
              <><strong>{displayTitle}</strong> 인증은 이미 완료되었습니다.</>
            ) : (
              <><strong>{displayTitle}</strong> 부스는 이미 방문하셨습니다.</>
            )}
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
