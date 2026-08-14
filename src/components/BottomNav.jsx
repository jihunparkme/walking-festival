const tabs = [
  { id: "home", label: "축제 소개" },
  { id: "stamp", label: "도장판" },
  { id: "finishPhoto", label: "완주 사진" },
];

export default function BottomNav({ tab, onChangeTab, isAuthenticated, showFinishPhotoTab }) {
  const visibleTabs = isAuthenticated
    ? tabs.filter((item) => item.id !== "finishPhoto" || showFinishPhotoTab)
    : tabs.slice(0, 1);

  return (
    <nav
      className="fixed inset-x-0 bottom-3 z-20 mx-auto w-[min(94%,420px)] rounded-full bg-white/95 p-2 shadow-soft backdrop-blur"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={`grid gap-2 text-sm ${
          visibleTabs.length === 3 ? "grid-cols-3" : visibleTabs.length === 2 ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeTab(item.id)}
            className={`rounded-full px-3 py-2 font-bold transition ${
              tab === item.id ? "bg-blue-200 text-[#1d4ed8]" : "bg-transparent text-[#6c7b90]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
