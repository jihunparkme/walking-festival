import { useEffect, useRef, useState } from "react";
import { uploadFinishPhoto } from "./finishPhoto";

/**
 * 완주 인증 사진을 카메라 촬영 또는 갤러리에서 선택해 업로드하는 공통 로직을 캡슐화한 훅.
 * "완주 인증 직후 사진 촬영 단계"(StampScanPage)와 "완주 사진 메뉴에서 사진 추가 등록"
 * (FinishPhotoSection) 양쪽에서 동일하게 사용되어, 촬영/선택/업로드 상태 관리 로직이
 * 두 곳에 중복 구현되는 것을 방지한다.
 *
 * 업로드 완료 후의 후속 동작(화면 전환, 목록 갱신 등)은 호출부마다 다르므로
 * `onUploaded` 콜백으로 위임한다.
 *
 * @param {Function} [onUploaded] - 사진 업로드 성공 시 호출되는 콜백
 */
export function useFinishPhotoCapture(onUploaded) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

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

  // OS 카메라 앱(capture 속성)을 여는 input 트리거
  function openCamera() {
    photoInputRef.current?.click();
  }

  // 카메라 앱 강제 실행이 지원되지 않는 기기(일부 데스크톱/구형 브라우저 등)를 위한
  // capture 속성 없는 input 트리거 — 갤러리(사진 보관함)에서 직접 선택할 수 있다.
  function openGallery() {
    galleryInputRef.current?.click();
  }

  async function uploadPhoto() {
    if (!photoFile) return;
    setPhotoUploading(true);
    setPhotoError("");
    try {
      await uploadFinishPhoto(photoFile);
      setPhotoFile(null);
      setPhotoPreview("");
      onUploaded?.();
    } catch (err) {
      setPhotoError(err.message || "사진 업로드 중 오류가 발생했습니다.");
    } finally {
      setPhotoUploading(false);
    }
  }

  return {
    photoPreview,
    photoUploading,
    photoError,
    photoInputRef,
    galleryInputRef,
    openCamera,
    openGallery,
    handlePhotoSelect,
    uploadPhoto,
  };
}
