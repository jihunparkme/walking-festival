const STEP_GOAL = 3000;

export default function WalkCertifySection({
  steps,
  geoStatus,
  geoEnabled,
  onStartGeolocation,
  onOpenLocationSettings,
  onStopGeolocation,
  onPhotoUpload,
  photoDataUrl,
}) {
  const challengeComplete = steps >= STEP_GOAL;

  return (
    <section className="soft-card space-y-5 p-4 md:p-7">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-bubble bg-skyMint p-4">
          <p className="text-sm font-semibold text-[#55677d]">걸음 수</p>
          <p className="mt-1 text-3xl font-extrabold">{steps.toLocaleString()} 보</p>
          <p className="mt-1 text-xs text-[#55677d]">목표 {STEP_GOAL.toLocaleString()}보</p>
        </div>
      </div>

      <div className="rounded-3xl border border-[#d7dfec] bg-white p-4">
        <p className="text-sm font-semibold">걷기 측정</p>
        <p className="mt-1 text-xs text-[#5f6f88]">{geoStatus}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onStartGeolocation}
            className="rounded-full bg-[#8dc5ff] px-4 py-2 text-sm font-bold text-white"
          >
            위치 기반 시작
          </button>
          <button
            type="button"
            onClick={onStopGeolocation}
            className="rounded-full bg-[#9fb2cc] px-4 py-2 text-sm font-bold text-white"
          >
            위치 측정 중지
          </button>
          <button
            type="button"
            onClick={onOpenLocationSettings}
            className="rounded-full bg-[#ff9f43] px-4 py-2 text-sm font-bold text-white"
          >
            위치 권한 설정 열기
          </button>
        </div>
        <p className="mt-2 text-xs text-[#5f6f88]">
          {geoEnabled ? "실제 위치 추적 활성화" : "위치 권한이 없으면 설정에서 허용해 주세요."}
        </p>
      </div>

      <div className="rounded-3xl border border-[#d7dfec] bg-white p-4">
        <p className="text-sm font-semibold">걷기 인증</p>
        <p className="mt-1 text-xs text-[#5f6f88]">목표 걸음 수 달성 후 사진을 업로드해 인증할 수 있습니다.</p>
        <label
          className={`mt-3 inline-flex cursor-pointer rounded-full px-4 py-2 text-sm font-bold text-white ${
            challengeComplete ? "bg-[#4ab58c]" : "bg-[#c6d0df]"
          }`}
        >
          인증하기 (카메라/갤러리)
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={!challengeComplete}
            onChange={onPhotoUpload}
          />
        </label>
        {!challengeComplete && (
          <p className="mt-2 text-xs text-[#8a6271]">아직 목표 걸음 수를 달성하지 못했습니다.</p>
        )}

        {photoDataUrl && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#e4e8ef]">
            <img src={photoDataUrl} alt="걷기 인증 사진" className="h-56 w-full object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}
