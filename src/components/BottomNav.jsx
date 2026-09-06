// 메뉴 개수가 늘어날 때 하단 내비게이션을 스와이프(가로 스크롤) 방식으로 바꾸면 일부 메뉴가
// 화면 밖에 숨어 존재 자체를 못 찾는 사용자가 생길 수 있어(특히 "도장판"처럼 핵심 기능일수록
// 치명적) 채택하지 않았습니다. 대신 항목 수에 맞춰 그리드 컬럼 수와 글자 크기/패딩을 줄여
// 모든 메뉴가 항상 한 화면에 보이도록 구성했습니다. (홈/캠페인 소개, 행사 안내, 도장판, 완주
// 사진까지 최대 4개 — 4개 정도는 좁은 화면에서도 전부 노출하는 편이 스와이프보다 발견성이 좋음)
const tabs = [
  { id: "home", label: "캠페인 소개" },
  { id: "guide", label: "행사 안내" },
  { id: "stamp", label: "도장판" },
  { id: "finishPhoto", label: "완주 사진" },
];

const GRID_COLS_CLASS = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export default function BottomNav({ tab, onChangeTab, isAuthenticated, showFinishPhotoTab }) {
  const visibleTabs = isAuthenticated
    ? tabs.filter((item) => item.id !== "finishPhoto" || showFinishPhotoTab)
    : tabs.filter((item) => item.id === "home" || item.id === "guide");

  const isCompact = visibleTabs.length >= 4;

  return (
    <nav
      className="fixed inset-x-0 bottom-3 z-20 mx-auto w-[min(94%,420px)] rounded-full bg-white/95 p-2 shadow-soft backdrop-blur"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={`grid gap-1.5 text-sm ${GRID_COLS_CLASS[visibleTabs.length] || "grid-cols-1"}`}>
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeTab(item.id)}
            className={`rounded-full font-bold transition ${isCompact ? "px-1.5 py-2 text-xs" : "px-3 py-2"} ${
              tab === item.id ? "bg-[#06539D]/25 text-[#05437E]" : "bg-transparent text-[#6c7b90]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
