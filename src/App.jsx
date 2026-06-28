import { useEffect, useMemo, useState } from "react";
import AdminPage from "./components/AdminPage";
import AdminPasswordModal from "./components/AdminPasswordModal";
import BottomNav from "./components/BottomNav";
import HomeSection from "./components/HomeSection";
import LoginModal from "./components/LoginModal";
import StampCardSection from "./components/StampCardSection";
import StampScanPage from "./components/StampScanPage";
import { fetchMe, registerOrLogin } from "./lib/auth";
import { fetchBooths } from "./lib/booths";
import { fetchMyStamps } from "./lib/stamps";

const STORAGE_KEYS = {
  stamps: "walkingFestival.stamps",
  lotteryNumber: "walkingFestival.lotteryNumber",
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

if (URL_BOOTH_ID) {
  window.history.replaceState({}, "", "/");
}

export default function App() {
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    return hash === "stamp" ? "stamp" : "home";
  });
  const [stamps, setStamps] = useState(() => readJSON(STORAGE_KEYS.stamps, {}));
  const [boothItems, setBoothItems] = useState([]);

  // 세션: 서버에서 확인, 로딩 중에는 undefined
  const [authStatus, setAuthStatus] = useState("loading"); // "loading" | "ok" | "none"
  const [lotteryNumber, setLotteryNumber] = useState(() => localStorage.getItem(STORAGE_KEYS.lotteryNumber) || "");
  const [participantName, setParticipantName] = useState(() => localStorage.getItem(STORAGE_KEYS.name) || "");

  const [showStampScan, setShowStampScan] = useState(Boolean(URL_BOOTH_ID));
  const [adminPasswordOpen, setAdminPasswordOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const completedStamps = useMemo(
    () => boothItems.filter((item) => stamps[item.booth_id]).length,
    [boothItems, stamps]
  );

  // 부스 목록 로드
  useEffect(() => {
    fetchBooths().then(setBoothItems).catch(console.error);
  }, []);

  // 앱 시작 시 HttpOnly 쿠키로 세션 확인
  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (me) {
          setParticipantName(me.name);
          setLotteryNumber(me.lotteryNumber);
          localStorage.setItem(STORAGE_KEYS.name, me.name);
          localStorage.setItem(STORAGE_KEYS.lotteryNumber, me.lotteryNumber);
          setAuthStatus("ok");
        } else {
          // 쿠키 세션 없음 — localStorage 캐시도 초기화
          localStorage.removeItem(STORAGE_KEYS.name);
          localStorage.removeItem(STORAGE_KEYS.lotteryNumber);
          localStorage.removeItem(STORAGE_KEYS.stamps);
          setParticipantName("");
          setLotteryNumber("");
          setStamps({});
          setAuthStatus("none");
        }
      })
      .catch(() => setAuthStatus("none"));
  }, []);

  // 세션 확인 후 도장 동기화
  useEffect(() => {
    if (authStatus !== "ok") return;
    fetchMyStamps()
      .then((serverStamps) => {
        setStamps(serverStamps);
        localStorage.setItem(STORAGE_KEYS.stamps, JSON.stringify(serverStamps));
      })
      .catch(console.error);
  }, [authStatus]);

  async function handleLoginSubmit({ name, phone }) {
    const { isNew, lotteryNumber: newLotteryNumber } = await registerOrLogin(name, phone);
    setParticipantName(name);
    setLotteryNumber(newLotteryNumber);
    localStorage.setItem(STORAGE_KEYS.name, name);
    localStorage.setItem(STORAGE_KEYS.lotteryNumber, newLotteryNumber);
    // isNew인 경우 DoneStep을 보여준 뒤 onClose에서 닫히므로 여기서 바로 닫지 않음
    if (!isNew) {
      setAuthStatus("ok");
    }
    return { isNew, lotteryNumber: newLotteryNumber };
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
      {showAdmin && <AdminPage onExit={() => setShowAdmin(false)} />}

      {!showAdmin && (
        <>
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
            {tab === "home" && (
              <HomeSection
                lotteryNumber={lotteryNumber}
                participantName={participantName}
                onAdminClick={() => setAdminPasswordOpen(true)}
              />
            )}
            {tab === "stamp" && (
              <StampCardSection
                boothItems={boothItems}
                stamps={stamps}
                completedStamps={completedStamps}
              />
            )}
          </main>

          <BottomNav tab={tab} onChangeTab={handleChangeTab} />

          {showStampScan && URL_BOOTH_ID && (
            <StampScanPage
              boothId={URL_BOOTH_ID}
              boothTitle={boothItems.find((b) => b.booth_id === URL_BOOTH_ID)?.title}
              isAuthenticated={authStatus === "ok"}
              onDone={handleStampDone}
            />
          )}

          <LoginModal
            open={authStatus === "none"}
            onSubmit={handleLoginSubmit}
            onClose={() => setAuthStatus("ok")}
          />

          <AdminPasswordModal
            open={adminPasswordOpen}
            onSuccess={() => { setAdminPasswordOpen(false); setShowAdmin(true); }}
            onClose={() => setAdminPasswordOpen(false)}
          />
        </>
      )}
    </div>
  );
}
