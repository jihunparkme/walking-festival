import { useEffect, useMemo, useState } from "react";
import BottomNav from "./components/BottomNav";
import HomeSection from "./components/HomeSection";
import LoginModal from "./components/LoginModal";
import StampCardSection from "./components/StampCardSection";
import StampScanPage from "./components/StampScanPage";
import { getToken, registerOrLogin, saveToken } from "./lib/auth";
import { fetchBooths } from "./lib/booths";
import { fetchMyStamps } from "./lib/stamps";

const STORAGE_KEYS = {
  stamps: "walkingFestival.stamps",
  userToken: "walkingFestival.userToken",
  participantId: "walkingFestival.participantId",
  name: "walkingFestival.name",
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// /stamp?booth=xxx URL인지 감지 (컴포넌트 바깥에서 한 번만 읽음)
const urlParams = new URLSearchParams(window.location.search);
const URL_BOOTH_ID = window.location.pathname === "/stamp" ? urlParams.get("booth") : null;

export default function App() {
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    return hash === "stamp" ? "stamp" : "home";
  });
  const [stamps, setStamps] = useState(() => readJSON(STORAGE_KEYS.stamps, {}));
  const [boothItems, setBoothItems] = useState([]);
  const [token, setToken] = useState(() => getToken());
  const [loginModalOpen, setLoginModalOpen] = useState(() => !getToken());
  const [participantId, setParticipantId] = useState(() => readJSON(STORAGE_KEYS.participantId, null));
  const [participantName, setParticipantName] = useState(() => localStorage.getItem(STORAGE_KEYS.name) || "");

  // QR 스캔 오버레이 표시 여부
  const [showStampScan, setShowStampScan] = useState(Boolean(URL_BOOTH_ID));

  const completedStamps = useMemo(
    () => boothItems.filter((item) => stamps[item.id]).length,
    [boothItems, stamps]
  );

  useEffect(() => {
    fetchBooths().then(setBoothItems).catch(console.error);
  }, []);

  // 참여자 ID가 확정되면 서버에서 도장 현황을 가져와 동기화한다.
  useEffect(() => {
    if (!participantId) return;
    fetchMyStamps(participantId)
      .then((serverStamps) => {
        setStamps(serverStamps);
        localStorage.setItem(STORAGE_KEYS.stamps, JSON.stringify(serverStamps));
      })
      .catch(console.error);
  }, [participantId]);

  async function handleLoginSubmit({ name, phone }) {
    const { token: newToken, participantId: newParticipantId, isNew } = await registerOrLogin(name, phone);
    saveToken(newToken);
    setToken(newToken);
    setParticipantName(name);
    localStorage.setItem(STORAGE_KEYS.name, name);
    localStorage.setItem(STORAGE_KEYS.participantId, JSON.stringify(newParticipantId));
    setParticipantId(newParticipantId);
    return { participantId: newParticipantId, isNew };
  }

  function handleChangeTab(nextTab) {
    setTab(nextTab);
    window.history.replaceState(null, "", `#${nextTab}`);
  }

  function handleStampDone({ status, boothId }) {
    if (status === "success" && boothId) {
      setStamps((prev) => {
        const next = { ...prev, [boothId]: true };
        localStorage.setItem(STORAGE_KEYS.stamps, JSON.stringify(next));
        return next;
      });
    }
    setShowStampScan(false);
    window.history.replaceState({}, "", "/");
    handleChangeTab("stamp");
  }

  return (
    <div className="min-h-screen pb-28 text-ink">
      <header className="mx-auto w-full max-w-[30rem] px-4 pt-6 md:max-w-4xl md:px-6">
        <div className="soft-card relative overflow-hidden p-4 md:p-7">
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-candyPink opacity-70" />
          <div className="absolute -bottom-12 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-limeCloud opacity-80" />
          <p className="text-sm font-semibold tracking-wide text-[#61718a]">세계자살예방의 날 · 9월 10일</p>
          <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">사람사랑 생명사랑 걷기캠페인</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4e5f75] md:text-base">
            따뜻한 걸음으로 생명의 소중함을 전하는 참여형 축제입니다. 부스 미션과 걷기 인증을 완료하고,
            희망의 메시지를 함께 나눠 보세요.
          </p>
        </div>
      </header>

      <main className="mx-auto mt-6 w-full max-w-[30rem] space-y-6 px-4 md:max-w-4xl md:px-6">
        {tab === "home" && <HomeSection participantId={participantId} participantName={participantName} />}

        {tab === "stamp" && (
          <StampCardSection
            boothItems={boothItems}
            stamps={stamps}
            completedStamps={completedStamps}
          />
        )}
      </main>

      <BottomNav tab={tab} onChangeTab={handleChangeTab} />

      {/* QR 스캔 오버레이 — /stamp?booth=xxx 로 접근 시 표시 */}
      {showStampScan && URL_BOOTH_ID && (
        <StampScanPage
          boothId={URL_BOOTH_ID}
          boothTitle={boothItems.find((b) => b.id === URL_BOOTH_ID)?.title}
          token={token}
          onDone={handleStampDone}
        />
      )}

      <LoginModal open={loginModalOpen} onSubmit={handleLoginSubmit} onClose={() => setLoginModalOpen(false)} />
    </div>
  );
}
