import { useMemo } from "react";
import stampSeal from "../assets/stamp-seal.svg";

export default function StampCardSection({
  boothItems,
  stamps,
  completedStamps,
  isTurnCompleted,
  isFinishCompleted,
  challengeCompleteStampCount,
  onSelectBooth,
  onSelectCheckpoint,
}) {
  const checkpointItems = [
    { key: "turn", title: "반환점", subtitle: "반환점 통과 인증", done: isTurnCompleted },
    { key: "finish", title: "완주", subtitle: "완주 인증", done: isFinishCompleted },
  ];

  /** 참여가 완료된 부스가 앞쪽에 오도록 정렬 (완료 여부 외 원래 순서는 유지) */
  const sortedBoothItems = useMemo(() => {
    return [...boothItems].sort((a, b) => {
      const doneA = Boolean(stamps[a.booth_id]);
      const doneB = Boolean(stamps[b.booth_id]);
      return doneA === doneB ? 0 : doneA ? -1 : 1;
    });
  }, [boothItems, stamps]);

  const isChallengeCompleted = completedStamps >= challengeCompleteStampCount;

  return (
    <section className="soft-card p-4 md:p-7">
      <div>
        <h2 className="text-xl font-bold">디지털 도장판</h2>
        <p className="mt-1 text-sm text-[#5b6c84]">
          부스를 클릭해 카메라로 QR 코드를 스캔하면 도장이 적립됩니다.
        </p>
        <p className="mt-0.5 text-xs text-[#8a9ab5]">획득한 도장이 보이지 않는다면 새로고침을 해주세요.</p>
        <p className="mt-3 flex justify-end">
          <span className="rounded-full bg-limeCloud px-3 py-1 text-sm font-bold">
            🔖 {completedStamps}개 부스 참여 완료
          </span>
        </p>
        {isChallengeCompleted && (
          <div className="mt-3 break-keep rounded-2xl bg-creamSun px-4 py-3 text-center text-sm font-bold text-[#3a4a5c]">
            🎉 챌린지 완료!
            <br />
            6번 생명사랑지킴이 챌린지부스에서
            <br />
            상품을 받아가세요!
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        {sortedBoothItems.map((item) => {
          const done = Boolean(stamps[item.booth_id]);
          return (
            <button
              key={item.booth_id}
              type="button"
              disabled={done}
              onClick={() => onSelectBooth?.(item)}
              className={`relative overflow-hidden rounded-3xl border-2 p-4 text-left ${
                done
                  ? "border-transparent bg-[#06539D]/25"
                  : "border-dashed border-[#b7c6db] bg-white active:bg-[#f3f6fb]"
              }`}
            >
              {done && (
                <img
                  src={stampSeal}
                  alt="도장 완료"
                  className="pointer-events-none absolute right-1 top-1 h-16 w-16 rotate-12 opacity-90"
                />
              )}
              <p className="text-sm font-bold">{item.title}</p>
              <p className="mt-1 text-xs text-[#5f6f88]">{item.subtitle}</p>
              <div className={`mt-3 text-xs font-semibold ${done ? "text-[#05437E]" : "text-[#8a9ab5]"}`}>
                {done ? "✓ 참여 완료!" : "📷 QR 인증하기"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t border-[#eef2f8] pt-5">
        <h3 className="text-sm font-bold text-[#3a4a5c]">걷기 인증</h3>
        <p className="mt-1 text-xs text-[#8a9ab5]">
          카드를 클릭해 카메라로 반환점/완주 지점의 QR 코드를 스캔하면 인증됩니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {checkpointItems.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={item.done}
              onClick={() => onSelectCheckpoint?.(item.key)}
              className={`relative overflow-hidden rounded-3xl border-2 p-4 text-left ${
                item.done
                  ? "border-transparent bg-[#06539D]/25"
                  : "border-dashed border-[#b7c6db] bg-white active:bg-[#f3f6fb]"
              }`}
            >
              {item.done && (
                <img
                  src={stampSeal}
                  alt="인증 완료"
                  className="pointer-events-none absolute right-1 top-1 h-16 w-16 rotate-12 opacity-90"
                />
              )}
              <p className="text-sm font-bold">{item.title}</p>
              <p className="mt-1 text-xs text-[#5f6f88]">{item.subtitle}</p>
              <div className={`mt-3 text-xs font-semibold ${item.done ? "text-[#05437E]" : "text-[#8a9ab5]"}`}>
                {item.done ? "✓ 인증 완료" : "📷 QR 인증하기"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
