import { useState } from "react";
import info1 from "../assets/images/info_1.jpeg";
import info2 from "../assets/images/info_2.jpeg";
import info3 from "../assets/images/info_3.jpeg";
import info4 from "../assets/images/info_4.jpeg";

const GUIDE_ITEMS = [
  { id: "schedule", label: "식순 및 행사안내", image: info1, alt: "식순 및 행사안내" },
  { id: "layout", label: "행사 배치 안내", image: info2, alt: "행사 배치 안내" },
  { id: "courseA", label: "사람사랑코스", image: info3, alt: "사람사랑코스(캠페인 코스A)" },
  { id: "courseB", label: "생명사랑코스", image: info4, alt: "생명사랑코스(캠페인 코스B)" },
];

export default function GuideSection() {
  const [activeId, setActiveId] = useState(GUIDE_ITEMS[0].id);
  const [zoomImage, setZoomImage] = useState(null);

  const activeItem = GUIDE_ITEMS.find((item) => item.id === activeId) ?? GUIDE_ITEMS[0];

  return (
    <>
      <section className="soft-card space-y-4 p-4 md:p-7">
        <div>
          <h2 className="text-xl font-bold">행사 안내</h2>
          <p className="mt-1 text-sm text-[#5f6f88]">
            당일 진행되는 식순, 부스 배치, 걷기 코스를 미리 확인해 보세요.
          </p>
        </div>

        {/* 이미지 4장을 한 화면에 나열하는 대신, 섹션 내부 세그먼트(탭) 전환 방식으로 구성했습니다.
            하단 메인 네비게이션에 스와이프를 도입하면 다른 핵심 메뉴(도장판 등)가 가려지거나
            찾기 어려워질 수 있어, 안내 콘텐츠 전환은 이 섹션 내부에서 해결합니다. */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {GUIDE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                activeId === item.id
                  ? "bg-[#06539D] text-white shadow-soft"
                  : "bg-[#f3f6fb] text-[#6c7b90] hover:bg-[#e7edf6]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setZoomImage(activeItem)}
          className="block w-full overflow-hidden rounded-bubble bg-[#f3f6fb]"
        >
          <img
            src={activeItem.image}
            alt={activeItem.alt}
            className="w-full object-contain"
          />
        </button>
        <p className="text-center text-xs text-[#8a97ab]">이미지를 탭하면 크게 볼 수 있어요.</p>
      </section>

      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage.image}
            alt={zoomImage.alt}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </>
  );
}
