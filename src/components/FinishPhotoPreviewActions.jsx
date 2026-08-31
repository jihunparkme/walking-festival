/**
 * 촬영/선택된 완주 사진 미리보기와 저장/재촬영/갤러리 선택 버튼 그룹을 렌더링하는 공용 컴포넌트.
 * `useFinishPhotoCapture` 훅으로 관리되는 상태(preview, uploading, error)를 그대로 받아 표시한다.
 *
 * @param {string} saveLabel - 저장 버튼의 기본(업로드 중이 아닐 때) 문구 (호출부마다 문구가 다름)
 */
export default function FinishPhotoPreviewActions({
  photoPreview,
  photoUploading,
  photoError,
  saveLabel,
  onSave,
  onRetake,
  onPickGallery,
}) {
  return (
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
          onClick={onSave}
          className="w-full rounded-bubble bg-[#05437E] px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {photoUploading ? "업로드 중…" : saveLabel}
        </button>
        <button
          type="button"
          disabled={photoUploading}
          onClick={onRetake}
          className="w-full rounded-bubble px-5 py-2 text-sm font-bold text-[#5b6c84] disabled:opacity-40"
        >
          다시 촬영하기
        </button>
        <button
          type="button"
          disabled={photoUploading}
          onClick={onPickGallery}
          className="w-full rounded-bubble px-5 py-2 text-sm font-bold text-[#5b6c84] disabled:opacity-40"
        >
          갤러리에서 선택
        </button>
      </div>
    </>
  );
}
