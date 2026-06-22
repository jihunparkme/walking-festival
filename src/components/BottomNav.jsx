const tabs = [
  { id: "home", label: "축제 소개" },
  { id: "stamp", label: "도장판" },
];

export default function BottomNav({ tab, onChangeTab }) {
  return (
    <nav className="fixed bottom-3 left-1/2 z-20 w-[min(94%,420px)] -translate-x-1/2 rounded-full bg-white/95 p-2 shadow-soft backdrop-blur">
      <div className="grid grid-cols-2 gap-2 text-sm">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeTab(item.id)}
            className={`rounded-full px-3 py-2 font-bold transition ${
              tab === item.id ? "bg-candyPink" : "bg-transparent text-[#6c7b90]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
