const tabs = [
  { id: "home", label: "축제 소개" },
  { id: "stamp", label: "도장판" },
];

export default function BottomNav({ tab, onChangeTab, isAuthenticated }) {
  const visibleTabs = isAuthenticated ? tabs : tabs.slice(0, 1);

  return (
    <nav className="fixed bottom-3 left-1/2 z-20 w-[min(94%,420px)] -translate-x-1/2 rounded-full bg-white/95 p-2 shadow-soft backdrop-blur">
      <div className={`grid gap-2 text-sm ${visibleTabs.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
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
