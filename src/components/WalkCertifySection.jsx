const STEP_GOAL = 3000;

export default function WalkCertifySection({
  entryNumber,
  steps,
  geoStatus,
  geoEnabled,
  onStartGeolocation,
  onOpenLocationSettings,
  onStopGeolocation,
  onPhotoUpload,
  photoDataUrl,
  onJoinCampaign,
}) {
  const challengeComplete = steps >= STEP_GOAL;

  if (!entryNumber) {
    return (
      <section className="soft-card flex min-h-[26rem] flex-col justify-between p-4 md:min-h-[30rem] md:p-7">
        <div className="space-y-4">
          <div className="rounded-bubble bg-creamSun p-4">
            <p className="text-sm font-semibold text-[#6b5f46]">걷기 인증 참여 안내</p>
            <p className="mt-2 text-sm leading-relaxed text-[#6b5f46]">
              하단 버튼을 눌러 캠페인에 참여하면 추첨용 고유 번호가 발급됩니다. 번호 발급 후 걸음 수 측정과
              인증 사진 업로드 기능이 활성화됩니다.
            </p>
          </div>

          <div className="rounded-3xl border border-[#d7dfec] bg-white p-4">
            <p className="text-sm font-semibold">참여 절차</p>
            <ol className="mt-2 space-y-1 text-xs leading-relaxed text-[#5f6f88]">
              <li>1. 캠페인 참여 버튼 클릭</li>
              <li>2. 고유 번호 발급 확인</li>
              <li>3. 걷기 측정 후 목표 걸음 수 달성</li>
              <li>4. 인증 사진 업로드 완료</li>
            </ol>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="button"
            onClick={onJoinCampaign}
            className="w-full rounded-full bg-[#ff7f50] px-4 py-3 text-sm font-extrabold text-white"
          >
            캠페인 참여하기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="soft-card space-y-5 p-4 md:p-7">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-bubble bg-creamSun p-4">
          <p className="text-sm font-semibold text-[#6b5f46]">추첨용 고유 번호</p>
          <p className="mt-1 text-3xl font-extrabold tracking-[0.12em]">{entryNumber}</p>
          <p className="mt-1 text-xs text-[#6b5f46]">참여 시 1회 발급되며 기기 내에 저장됩니다.</p>
        </div>
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
