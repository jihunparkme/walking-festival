import { useEffect, useRef, useState } from "react";
import { uploadFinishPhoto } from "../lib/finishPhoto";

const STATUS = {
  WAITING: "waiting",     // 토큰 없음 — 로그인 모달 대기 중
  LOADING: "loading",     // API 호출 중
  SUCCESS: "success",     // 인증 완료
  DUPLICATE: "duplicate", // 이미 완료됨
  ERROR: "error",         // 오류
  PHOTO: "photo",         // 완주 인증 완료 — 완주 사진 촬영 대기
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
 * 완주(finish) 인증이 성공하면 자동 이동 대신 완주 사진 촬영 단계(PHOTO)로 전환되며,
 * 사진은 서버가 참여자 세션으로 walking-festival(private) 버킷에 업로드합니다.
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

  // 완주(finish) 인증 후 사진 촬영 단계에서 사용
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef(null);

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
          // 완주 인증은 성공 즉시 사진 촬영 단계로 전환 (자동 이동하지 않음)
          if (isCheckpoint && checkpointType === "finish") {
            setStatus(STATUS.PHOTO);
            return;
          }
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

  // objectURL은 재선택/언마운트 시 이전 값을 해제해 메모리 누수를 방지
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 동일 파일 재선택 시에도 change 이벤트가 발생하도록 초기화
    if (!file) return;
    setPhotoError("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  // "완주 사진 인증하기" / "다시 촬영하기" 클릭 시 기기의 촬영 모드 진입
  function openCamera() {
    photoInputRef.current?.click();
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;
    setPhotoUploading(true);
    setPhotoError("");
    try {
      await uploadFinishPhoto(photoFile);
      onDone({ status: "success", mode, boothId, checkpointType });
    } catch (err) {
      setPhotoError(err.message || "사진 업로드 중 오류가 발생했습니다.");
    } finally {
      setPhotoUploading(false);
    }
  }

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

      {status === STATUS.PHOTO && (
        <>
          <div className="mb-4 animate-bounce text-6xl">🎉</div>
          <h2 className="text-2xl font-extrabold text-[#1d4ed8]">완주 인증 완료!</h2>

          {/* 촬영된 사진이 없으면 인증 버튼만, 있으면 미리보기와 저장/재촬영 버튼만 노출 */}
          {!photoPreview ? (
            <>
              <p className="mt-2 text-sm text-[#5b6c84]">완주를 기념하는 사진을 남겨주세요.</p>
              <button
                type="button"
                onClick={openCamera}
                className="mt-5 rounded-bubble bg-[#1d4ed8] px-6 py-3 text-sm font-bold text-white"
              >
                완주 사진 인증하기
              </button>
            </>
          ) : (
            <>
              <img
                src={photoPreview}
                alt="완주 사진 미리보기"
                className="mt-4 h-48 w-48 rounded-bubble object-cover shadow-soft"
              />

              {photoError && <p className="mt-2 text-xs text-red-500">{photoError}</p>}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={handlePhotoUpload}
                  className="rounded-bubble bg-[#1d4ed8] px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {photoUploading ? "업로드 중…" : "사진 저장하고 완료"}
                </button>
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={openCamera}
                  className="rounded-bubble px-5 py-2 text-sm font-bold text-[#5b6c84] disabled:opacity-40"
                >
                  다시 촬영하기
                </button>
              </div>
            </>
          )}

          {/* 실제 촬영/파일 선택은 숨겨진 input이 담당, 버튼 클릭 시 프로그래매틱하게 오픈 */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelect}
          />
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
