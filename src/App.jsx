import { useEffect, useMemo, useState } from "react";
import BottomNav from "./components/BottomNav";
import HomeSection from "./components/HomeSection";
import LoginModal from "./components/LoginModal";
import PasswordModal from "./components/PasswordModal";
import StampCardSection from "./components/StampCardSection";
import { stampItems } from "./data/stamps";
import { getToken, registerOrLogin, saveToken } from "./lib/auth";

const STORAGE_KEYS = {
  stamps: "walkingFestival.stamps",
  userToken: "walkingFestival.userToken",
};

const ADMIN_PASSWORD = "1234";
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [stamps, setStamps] = useState(() => readJSON(STORAGE_KEYS.stamps, {}));

  const [loginModalOpen, setLoginModalOpen] = useState(() => !getToken());

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const completedStamps = useMemo(
    () => stampItems.filter((item) => stamps[item.id]).length,
    [stamps]
  );

  useEffect(() => {
    // 도장 상태를 자동 저장해 새로고침 이후에도 유지한다.
    localStorage.setItem(STORAGE_KEYS.stamps, JSON.stringify(stamps));
  }, [stamps]);

  function openStampModal(stampId) {
    if (stamps[stampId]) return;
    setSelectedStamp(stampId);
    setPasswordInput("");
    setPasswordError("");
    setPasswordModalOpen(true);
  }

  function submitStampPassword() {
    if (passwordInput !== ADMIN_PASSWORD) {
      setPasswordError("비밀번호가 올바르지 않습니다.");
      return;
    }
    setStamps((prev) => ({ ...prev, [selectedStamp]: true }));
    setPasswordModalOpen(false);
    setSelectedStamp(null);
  }

  async function handleLoginSubmit({ name, phone }) {
    const { token } = await registerOrLogin(name, phone);
    saveToken(token);
    setLoginModalOpen(false);
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
        {tab === "home" && <HomeSection />}

        {tab === "stamp" && (
          <StampCardSection
            stamps={stamps}
            completedStamps={completedStamps}
            onOpenStampModal={openStampModal}
          />
        )}
      </main>

      <BottomNav tab={tab} onChangeTab={setTab} />

      <PasswordModal
        open={passwordModalOpen}
        value={passwordInput}
        error={passwordError}
        onChange={setPasswordInput}
        onCancel={() => setPasswordModalOpen(false)}
        onSubmit={submitStampPassword}
      />

      <LoginModal open={loginModalOpen} onSubmit={handleLoginSubmit} />
    </div>
  );
}
