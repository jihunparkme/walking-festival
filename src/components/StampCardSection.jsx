import { stampItems } from "../data/stamps";
import stampSeal from "../assets/stamp-seal.svg";

export default function StampCardSection({ stamps, completedStamps, onStamp }) {
  return (
    <section className="soft-card p-4 md:p-7">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold">디지털 도장판</h2>
          <p className="mt-1 text-sm text-[#5b6c84]">부스를 방문하고 도장을 받아보세요.</p>
        </div>
        <p className="rounded-full bg-limeCloud px-3 py-1 text-sm font-bold">{completedStamps}/5 완료</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        {stampItems.map((item) => {
          const done = Boolean(stamps[item.id]);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onStamp(item.id)}
              className={`relative overflow-hidden rounded-3xl border-2 p-4 text-left transition ${
                done
                  ? "border-transparent bg-candyPink/70"
                  : "border-dashed border-[#b7c6db] bg-white hover:border-[#87a3c8]"
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
              <div className="mt-3 text-xs font-semibold">{done ? "도장 완료" : "탭해서 도장 받기"}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
