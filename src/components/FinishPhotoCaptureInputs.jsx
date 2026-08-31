/**
 * 완주 인증 사진 촬영/선택용 숨겨진 file input 2종을 렌더링하는 공용 컴포넌트.
 * `useFinishPhotoCapture` 훅과 함께 사용한다.
 * - photoInputRef: capture 속성으로 OS 카메라 앱을 강제 실행하는 input (모바일 전용)
 * - galleryInputRef: capture 속성 없이 OS 기본 파일 선택(사진 보관함/갤러리 포함) UI를 여는 폴백 input
 */
export default function FinishPhotoCaptureInputs({ photoInputRef, galleryInputRef, onSelect }) {
  return (
    <>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onSelect}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onSelect}
      />
    </>
  );
}
