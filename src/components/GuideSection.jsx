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
  const [zoomImage, setZoomImage] = useState(null);

  return (
    <>
      <section className="soft-card space-y-5 p-4 md:p-7">
        <div>
          <h2 className="text-xl font-bold">행사 안내</h2>
          <p className="mt-1 text-sm text-[#5f6f88]">
            당일 진행되는 식순, 부스 배치, 걷기 코스를 미리 확인해 보세요.
          </p>
        </div>

        {/* 탭 전환 대신 4장을 세로로 나열해 스크롤로 훑어볼 수 있게 구성했습니다.
            탭을 눌러야 다음 이미지를 볼 수 있는 클릭 부담을 줄이고, 순서대로 자연스럽게
            읽어 내려가도록 하기 위함입니다. */}
        {GUIDE_ITEMS.map((item) => (
          <div key={item.id} className="space-y-2">
            <p className="text-sm font-bold text-[#3a4a5c]">{item.label}</p>
            <button
              type="button"
              onClick={() => setZoomImage(item)}
              className="block w-full overflow-hidden rounded-bubble bg-[#f3f6fb]"
            >
              <img src={item.image} alt={item.alt} className="w-full object-contain" />
            </button>
          </div>
        ))}
        <p className="text-center text-xs text-[#8a97ab]">이미지를 탭하면 크게 볼 수 있어요.</p>
      </section>

      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomImage(null)}
        >
          <button
            type="button"
            onClick={() => setZoomImage(null)}
            aria-label="닫기"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-[#3a4a5c] shadow-soft"
          >
            ✕
          </button>
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
