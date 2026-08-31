import { useEffect, useRef, useState } from "react";
import { useFinishPhotoCapture } from "../lib/useFinishPhotoCapture";
import FinishPhotoCaptureInputs from "./FinishPhotoCaptureInputs";
import FinishPhotoPreviewActions from "./FinishPhotoPreviewActions";
import SurveyBanner from "./SurveyBanner";

const STATUS = {
  WAITING: "waiting",     // 토큰 없음 — 로그인 모달 대기 중
  LOADING: "loading",     // API 호출 중
  SUCCESS: "success",     // 인증 완료
  DUPLICATE: "duplicate", // 이미 완료됨
  ERROR: "error",         // 오류
  PHOTO: "photo",         // 완주 인증 완료 — 완주 사진 촬영 대기
  PHOTO_SAVED: "photo_saved", // 완주 사진 업로드(저장) 완료
  TURN_REQUIRED: "turn_required", // 완주 인증 시도했지만 반환점 인증이 먼저 필요함
  NOT_PARTICIPATING: "not_participating", // 세션 확인 결과 캠페인 미참여(로그인 안 됨) 상태
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
 * @param {"loading"|"ok"|"none"} authStatus - 세션 확인 상태 ("loading": 확인 중, "ok": 로그인됨, "none": 미참여/로그아웃)
 * @param {Function} onDone           - 완료 콜백 ({ status, mode, boothId, checkpointType })
 */
export default function StampScanPage({
  mode = "booth",
  boothId,
  boothSig,
  boothTitle,
  checkpointType,
  authStatus,
  onDone,
}) {
  const isAuthenticated = authStatus === "ok";
  const [status, setStatus] = useState(isAuthenticated ? STATUS.LOADING : STATUS.WAITING);
  const [errorMsg, setErrorMsg] = useState("");
  const processedRef = useRef(false);

  // 완주(finish) 인증 후 사진 촬영 단계에서 사용 — 업로드 성공 시 저장 완료 화면을
  // 잠시 보여준 뒤 완료 콜백으로 전환한다.
  const {
    photoPreview,
    photoUploading,
    photoError,
    photoInputRef,
    galleryInputRef,
    openCamera,
    openGallery,
    handlePhotoSelect,
    uploadPhoto,
  } = useFinishPhotoCapture(() => {
    setStatus(STATUS.PHOTO_SAVED);
    setTimeout(() => onDone({ status: "success", mode, checkpointType }), 2000);
  });

  const isCheckpoint = mode === "checkpoint";
  const checkpointLabel = CHECKPOINT_LABEL[checkpointType];

  // 세션 확인 결과 로그인되어 있지 않으면(캠페인 미참여) 대기 화면 대신 안내 화면으로 전환한다.
  // 자동으로 홈으로 이동하지 않고, 사용자가 확인 버튼을 눌러야 홈 하단으로 이동한다.
  useEffect(() => {
    if (authStatus === "none") {
      setStatus((prev) => (prev === STATUS.WAITING ? STATUS.NOT_PARTICIPATING : prev));
    }
  }, [authStatus]);

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
          // 반환점 인증은 설문조사 참여를 유도하기 위해 자동 이동 대신 확인 버튼을 노출한다.
          if (!(isCheckpoint && checkpointType === "turn")) {
            setTimeout(() => onDone({ status: "success", mode, boothId, checkpointType }), 2000);
          }
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

  // "사진 촬영 없이 인증하기" 클릭 시 사진 등록 없이 바로 완주 사진 메뉴로 이동한다.
  function handleSkipPhoto() {
    onDone({ status: "success", mode, checkpointType, skipPhoto: true });
  }

  const displayTitle = isCheckpoint ? checkpointLabel?.title : (boothTitle || boothId);
  const verbLabel = isCheckpoint ? checkpointLabel?.verb : "도장";

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-white/95 px-6 text-center backdrop-blur-sm">
      {status === STATUS.WAITING && (
        <>
          <div className="mb-4 text-5xl">📋</div>
          <h2 className="text-xl font-extrabold">참여자 확인 중</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">참여자 정보를 확인 중입니다.</p>
          <p className="mt-1 text-xs text-[#8a9ab5]">잠시만 기다려 주세요.</p>
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

          {isCheckpoint && checkpointType === "turn" ? (
            <>
              <SurveyBanner
                className="mt-5 w-full max-w-xs shadow-soft"
                message="📝 캠페인 설문조사에 참여하고 소중한 의견을 들려주세요!"
              />
              <button
                type="button"
                onClick={() => onDone({ status: "success", mode, boothId, checkpointType })}
                className="mt-3 w-full max-w-xs rounded-bubble bg-[#05437E] px-6 py-3 text-sm font-bold text-white"
              >
                확인
              </button>
            </>
          ) : (
            <p className="mt-5 text-xs text-[#8a9ab5]">잠시 후 도장판으로 이동합니다…</p>
          )}
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
                onClick={handleSkipPhoto}
                className="mt-4 w-full max-w-xs rounded-bubble px-5 py-2 text-sm font-bold text-[#5b6c84]"
              >
                사진 촬영 없이 인증하기
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
            <FinishPhotoPreviewActions
              photoPreview={photoPreview}
              photoUploading={photoUploading}
              photoError={photoError}
              saveLabel="사진 저장하고 완료"
              onSave={uploadPhoto}
              onRetake={openCamera}
              onPickGallery={openGallery}
            />
          )}

          <FinishPhotoCaptureInputs
            photoInputRef={photoInputRef}
            galleryInputRef={galleryInputRef}
            onSelect={handlePhotoSelect}
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

      {status === STATUS.NOT_PARTICIPATING && (
        <>
          <div className="mb-4 text-5xl">⚠️</div>
          <h2 className="text-xl font-extrabold">캠페인 미참여 상태</h2>
          <p className="mt-2 text-sm text-[#5b6c84]">
            홈 화면에서 걷기 챌린지 참여 버튼을 통해 참여 후
            <br />
            다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => onDone({ status: "not_participating" })}
            className="mt-6 rounded-bubble bg-[#05437E] px-6 py-3 text-sm font-bold text-white"
          >
            확인
          </button>
        </>
      )}
    </div>
  );
}
