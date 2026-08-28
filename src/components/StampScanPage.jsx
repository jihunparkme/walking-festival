import { useEffect, useRef, useState } from "react";
import { uploadFinishPhoto } from "../lib/finishPhoto";

const STATUS = {
  WAITING: "waiting",     // 토큰 없음 — 로그인 모달 대기 중
  LOADING: "loading",     // API 호출 중
  SUCCESS: "success",     // 인증 완료
  DUPLICATE: "duplicate", // 이미 완료됨
  ERROR: "error",         // 오류
  PHOTO: "photo",         // 완주 인증 완료 — 완주 사진 촬영 대기
  PHOTO_SAVED: "photo_saved", // 완주 사진 업로드(저장) 완료
  TURN_REQUIRED: "turn_required", // 완주 인증 시도했지만 반환점 인증이 먼저 필요함
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
 * @param {string}   boothSig         - (booth 모드) URL 쿼리에서 읽은 서버 서명(sig) — booth_id와 함께 검증됨
 * @param {string}   boothTitle       - (booth 모드) 부스 표시 이름 (없으면 boothId 사용)
 * @param {"turn"|"finish"} checkpointType - (checkpoint 모드) 체크포인트 종류
 * @param {boolean}  isAuthenticated  - 세션 확인 완료 여부
 * @param {Function} onDone           - 완료 콜백 ({ status, mode, boothId, checkpointType })
 */
export default function StampScanPage({
  mode = "booth",
  boothId,
  boothSig,
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
  const galleryInputRef = useRef(null);

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

    if (!isCheckpoint && (!boothId || !boothSig)) {
      setStatus(STATUS.ERROR);
      setErrorMsg("유효하지 않은 QR 코드입니다.");
      setTimeout(() => onDone({ status: "error" }), 3000);
      return;
    }

    processedRef.current = true;
    setStatus(STATUS.LOADING);

    const url = isCheckpoint ? "/api/checkpoint" : "/api/stamp";
    const body = isCheckpoint ? { type: checkpointType } : { boothId, sig: boothSig };

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
          const data = await res.json().catch(() => ({}));
          // 완주 인증은 이미 완료됐지만 사진이 아직 등록되지 않은 경우
          // 단순 중복 안내 대신 사진 촬영 단계로 다시 진입시켜 등록을 이어갈 수 있게 한다.
          if (isCheckpoint && checkpointType === "finish" && data.needsPhoto) {
            setStatus(STATUS.PHOTO);
            return;
          }
          setStatus(STATUS.DUPLICATE);
          setTimeout(() => onDone({ status: "duplicate", mode, boothId, checkpointType }), 2500);
        } else if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.code === "TURN_REQUIRED") {
            // 자동 이동 없이 안내 화면에 머무르며, 사용자가 직접 홈으로 이동
            setStatus(STATUS.TURN_REQUIRED);
            return;
          }
          setStatus(STATUS.ERROR);
          setErrorMsg(data.error || "오류가 발생했습니다.");
          setTimeout(() => onDone({ status: "error" }), 3000);
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
  }, [isAuthenticated, boothId, boothSig, checkpointType]);

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

  // "완주 사진 인증하기" / "다시 촬영하기" 클릭 시 OS 카메라 앱(capture 속성)을 여는 input 트리거
  function openCamera() {
    photoInputRef.current?.click();
  }

  // 카메라 앱 강제 실행이 지원되지 않는 기기(일부 데스크톱/구형 브라우저 등)를 위한
  // capture 속성 없는 input 트리거 — 갤러리(사진 보관함)에서 직접 선택할 수 있다.
  function openGallery() {
    galleryInputRef.current?.click();
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;
    setPhotoUploading(true);
    setPhotoError("");
    try {
      await uploadFinishPhoto(photoFile);
      // 저장 완료 알림을 잠시 보여준 뒤 완료 콜백으로 전환
      setStatus(STATUS.PHOTO_SAVED);
      setTimeout(() => onDone({ status: "success", mode, checkpointType }), 2000);
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
          <h2 className="text-2xl font-extrabold text-[#05437E]">
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
          <h2 className="text-2xl font-extrabold text-[#05437E]">완주 인증 완료!</h2>

          {!photoPreview ? (
            /* 촬영된 사진이 없으면 인증 버튼만 노출 */
            <>
              <p className="mt-2 text-sm text-[#5b6c84]">완주를 기념하는 사진을 남겨주세요.</p>
              <button
                type="button"
                onClick={openCamera}
                className="mt-5 rounded-bubble bg-[#05437E] px-6 py-3 text-sm font-bold text-white"
              >
                완주 사진 인증하기
              </button>
              <button
                type="button"
                onClick={openGallery}
                className="mt-3 text-xs font-semibold text-[#5b6c84] underline underline-offset-2"
              >
                카메라가 안 열리나요? 갤러리에서 선택하기
              </button>
            </>
          ) : (
            /* 촬영 완료 — 미리보기와 저장/재촬영 버튼만 노출 */
            <>
              <img
                src={photoPreview}
                alt="완주 사진 미리보기"
                className="mt-4 h-48 w-48 rounded-bubble object-cover shadow-soft"
              />

              {photoError && <p className="mt-2 text-xs text-red-500">{photoError}</p>}

              <div className="mt-5 flex w-full max-w-xs flex-col gap-3">
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={handlePhotoUpload}
                  className="w-full rounded-bubble bg-[#05437E] px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {photoUploading ? "업로드 중…" : "사진 저장하고 완료"}
                </button>
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={openCamera}
                  className="w-full rounded-bubble px-5 py-2 text-sm font-bold text-[#5b6c84] disabled:opacity-40"
                >
                  다시 촬영하기
                </button>
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={openGallery}
                  className="w-full rounded-bubble px-5 py-2 text-sm font-bold text-[#5b6c84] disabled:opacity-40"
                >
                  갤러리에서 선택
                </button>
              </div>
            </>
          )}

          {/* 모바일 전용: capture 속성으로 OS 카메라 앱을 여는 숨겨진 input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelect}
          />

          {/* 카메라 앱 강제 실행이 실패하는 기기를 위한 폴백: capture 속성 없이
              OS 기본 파일 선택(사진 보관함/갤러리 포함) UI를 여는 숨겨진 input */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </>
      )}

      {status === STATUS.PHOTO_SAVED && (
        <>
          <div className="mb-4 animate-bounce text-6xl">✅</div>
          <h2 className="text-2xl font-extrabold text-[#05437E]">저장이 완료되었습니다!</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">완주 인증 사진이 정상적으로 저장되었습니다.</p>
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

      {status === STATUS.TURN_REQUIRED && (
        <>
          <div className="mb-4 text-5xl">🚩</div>
          <h2 className="text-xl font-extrabold">반환점 인증이 먼저 필요해요</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">
            완주 인증은 반환점 QR 코드를 먼저 찍은 후 이용해 주세요.
          </p>
          <button
            type="button"
            onClick={() => onDone({ status: "home" })}
            className="mt-6 rounded-bubble bg-[#05437E] px-6 py-3 text-sm font-bold text-white"
          >
            홈으로 이동
          </button>
        </>
      )}
    </div>
  );
}
