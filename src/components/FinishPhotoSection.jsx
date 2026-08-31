import { useEffect, useRef, useState } from "react";
import { fetchFinishPhotoUrl } from "../lib/finishPhoto";
import { useFinishPhotoCapture } from "../lib/useFinishPhotoCapture";
import FinishPhotoCaptureInputs from "./FinishPhotoCaptureInputs";
import FinishPhotoPreviewActions from "./FinishPhotoPreviewActions";

/**
 * 완주 인증 사진 조회 탭.
 * 완주(finish) 인증을 완료한 참여자라면 사진 등록 여부와 관계없이 진입할 수 있는 메뉴이며,
 * 진입 시 서버에서 서명된 URL(private 버킷, 임시 유효)을 받아와 사진을 보여준다.
 * 서명된 URL은 유효 시간(10분)이 있어, 탭을 오래 켜둔 채 만료되면 이미지 로드가
 * 실패할 수 있다 — 최초 1회는 자동으로 새 URL을 재발급받아 조용히 복구를 시도한다.
 * 사진 촬영 없이 완주 인증만 완료한 경우(등록된 사진 없음)에는 이 화면에서 바로
 * 카메라 촬영 또는 갤러리 선택으로 사진을 추가 등록할 수 있다.
 *
 * @param {Function} [onPhotoUploaded] - 사진 등록(추가) 완료 시 호출되는 콜백
 */
export default function FinishPhotoSection({ onPhotoUploaded }) {
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "empty" | "error"
  const [photoUrl, setPhotoUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const autoRetriedRef = useRef(false);

  // 사진 미등록(empty) 상태에서 카메라/갤러리로 촬영 또는 선택한 사진을 업로드
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
    onPhotoUploaded?.();
    // 업로드한 사진을 바로 보여주기 위해 서명된 URL을 다시 조회
    setRetryCount((n) => n + 1);
  });

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchFinishPhotoUrl()
      .then((url) => {
        if (cancelled) return;
        if (url) {
          setPhotoUrl(url);
          setStatus("ready");
        } else {
          setStatus("empty");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err.message || "사진을 불러오는 중 오류가 발생했습니다.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  function handleRetry() {
    window.location.reload();
  }

  // 서명된 URL 만료 등으로 이미지 로드가 실패하면, 최초 1회에 한해 새 URL을
  // 자동으로 재요청해 조용히 복구를 시도하고, 그래도 실패하면 오류 화면으로 전환한다.
  function handleImageError() {
    if (autoRetriedRef.current) {
      setErrorMsg("사진을 불러오는 중 오류가 발생했습니다.");
      setStatus("error");
      return;
    }
    autoRetriedRef.current = true;
    setRetryCount((n) => n + 1);
  }

  return (
    <section className="soft-card p-4 md:p-7">
      <h2 className="text-xl font-bold">완주 인증 사진</h2>
      <p className="mt-1 text-sm text-[#5b6c84]">등록하신 완주 인증 사진을 확인할 수 있습니다.</p>

      <div className="mt-5 flex flex-col items-center justify-center">
        {status === "loading" && (
          <p className="py-10 text-sm text-[#8a9ab5]">사진을 불러오는 중…</p>
        )}
        {status === "error" && (
          <>
            <p className="py-4 text-sm text-red-500">{errorMsg}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-bubble bg-[#05437E] px-5 py-2 text-sm font-bold text-white"
            >
              다시 시도
            </button>
          </>
        )}
        {status === "ready" && (
          <img
            src={photoUrl}
            alt="완주 인증 사진"
            className="max-h-[28rem] w-full max-w-sm rounded-bubble object-cover shadow-soft"
            onError={handleImageError}
          />
        )}
        {status === "empty" && (
          <>
            {!photoPreview ? (
              /* 등록된 사진이 없는 경우 — 촬영 또는 갤러리 선택 안내 */
              <>
                <p className="py-2 text-sm text-[#5b6c84]">아직 등록된 완주 인증 사진이 없습니다.</p>
                <button
                  type="button"
                  onClick={openCamera}
                  className="mt-3 w-full max-w-xs rounded-bubble bg-[#05437E] px-6 py-3 text-sm font-bold text-white"
                >
                  완주 사진 촬영하기
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
              /* 촬영/선택 완료 — 미리보기와 저장/재촬영 버튼 노출 */
              <FinishPhotoPreviewActions
                photoPreview={photoPreview}
                photoUploading={photoUploading}
                photoError={photoError}
                saveLabel="사진 저장하기"
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
      </div>
    </section>
  );
}
