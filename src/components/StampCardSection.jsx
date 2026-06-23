import stampSeal from "../assets/stamp-seal.svg";

export default function StampCardSection({ boothItems, stamps, completedStamps }) {
  return (
    <section className="soft-card p-4 md:p-7">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold">디지털 도장판</h2>
          <p className="mt-1 text-sm text-[#5b6c84]">부스 QR 코드를 스캔하면 도장이 적립됩니다.</p>
          <p className="mt-0.5 text-xs text-[#8a9ab5]">획득한 도장이 보이지 않는다면 새로고침을 해주세요.</p>
        </div>
        <p className="rounded-full bg-limeCloud px-3 py-1 text-sm font-bold">{completedStamps}/{boothItems.length} 완료</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        {boothItems.map((item) => {
          const done = Boolean(stamps[item.id]);
          return (
            <div
              key={item.id}
              className={`relative overflow-hidden rounded-3xl border-2 p-4 ${
                done
                  ? "border-transparent bg-candyPink/70"
                  : "border-dashed border-[#b7c6db] bg-white"
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
              <div className={`mt-3 text-xs font-semibold ${done ? "text-[#d94a70]" : "text-[#8a9ab5]"}`}>
                {done ? "✓ 도장 완료" : "QR 스캔 필요"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
