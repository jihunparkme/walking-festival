import { useEffect, useRef, useState } from "react";
import { fetchFinishPhotoUrl, uploadFinishPhoto } from "../lib/finishPhoto";

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

  // 사진 미등록(empty) 상태에서 카메라/갤러리로 촬영 또는 선택 중인 사진
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

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

  // objectURL은 재선택/언마운트 시 이전 값을 해제해 메모리 누수를 방지
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handleRetry() {
    autoRetriedRef.current = false;
    setRetryCount((n) => n + 1);
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 동일 파일 재선택 시에도 change 이벤트가 발생하도록 초기화
    if (!file) return;
    setPhotoError("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function openCamera() {
    photoInputRef.current?.click();
  }

  // 카메라 앱 강제 실행이 지원되지 않는 기기를 위한 폴백: 갤러리(사진 보관함)에서 직접 선택
  function openGallery() {
    galleryInputRef.current?.click();
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;
    setPhotoUploading(true);
    setPhotoError("");
    try {
      await uploadFinishPhoto(photoFile);
      setPhotoFile(null);
      setPhotoPreview("");
      onPhotoUploaded?.();
      // 업로드한 사진을 바로 보여주기 위해 서명된 URL을 다시 조회
      setRetryCount((n) => n + 1);
    } catch (err) {
      setPhotoError(err.message || "사진 업로드 중 오류가 발생했습니다.");
    } finally {
      setPhotoUploading(false);
    }
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
              <>
                <img
                  src={photoPreview}
                  alt="완주 사진 미리보기"
                  className="h-48 w-48 rounded-bubble object-cover shadow-soft"
                />

                {photoError && <p className="mt-2 text-xs text-red-500">{photoError}</p>}

                <div className="mt-5 flex w-full max-w-xs flex-col gap-3">
                  <button
                    type="button"
                    disabled={photoUploading}
                    onClick={handlePhotoUpload}
                    className="w-full rounded-bubble bg-[#05437E] px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {photoUploading ? "업로드 중…" : "사진 저장하기"}
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
      </div>
    </section>
  );
}
