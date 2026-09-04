import { useCallback, useEffect, useMemo, useState } from "react";
import AdminPage from "./components/AdminPage";
import AdminPasswordModal from "./components/AdminPasswordModal";
import BottomNav from "./components/BottomNav";
import ChallengeCompleteModal from "./components/ChallengeCompleteModal";
import HomeSection from "./components/HomeSection";
import LoginModal from "./components/LoginModal";
import FinishPhotoSection from "./components/FinishPhotoSection";
import StampCardSection from "./components/StampCardSection";
import StampScanPage from "./components/StampScanPage";
import SurveyBanner from "./components/SurveyBanner";
import { fetchMe, logout, registerOrLogin } from "./lib/auth";
import { fetchBooths } from "./lib/booths";
import { fetchMyStamps } from "./lib/stamps";

const STORAGE_KEYS = {
  stamps: "walkingFestival.stamps",
  lotteryNumber: "walkingFestival.lotteryNumber",
  name: "walkingFestival.name",
};

// 챌린지 완료 기준 부스 참여 개수 (전체 부스 개수와 무관하게 최소 5개 참여 시 완료)
const CHALLENGE_COMPLETE_STAMP_COUNT = 5;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// /stamp?booth=xxx&sig=yyy (부스 QR, booth_id + 서버 서명) 또는 /stamp?type=turn|finish URL인지 감지 (컴포넌트 바깥에서 한 번만 읽음)
const urlParams = new URLSearchParams(window.location.search);
const isStampPath = window.location.pathname === "/stamp";
const URL_BOOTH_ID = isStampPath ? urlParams.get("booth") : null;
const URL_BOOTH_SIG = isStampPath ? urlParams.get("sig") : null;
const URL_CHECKPOINT_TYPE = isStampPath ? urlParams.get("type") : null;
const VALID_CHECKPOINT_TYPES = ["turn", "finish"];
const URL_TYPE = VALID_CHECKPOINT_TYPES.includes(URL_CHECKPOINT_TYPE) ? URL_CHECKPOINT_TYPE : null;

if ((URL_BOOTH_ID && URL_BOOTH_SIG) || URL_TYPE) {
  window.history.replaceState({}, "", "/");
}

export default function App() {
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    return hash === "stamp" || hash === "finishPhoto" ? hash : "home";
  });
  const [stamps, setStamps] = useState(() => readJSON(STORAGE_KEYS.stamps, {}));
  const [boothItems, setBoothItems] = useState([]);

  // 세션: 서버에서 확인, 로딩 중에는 undefined
  const [authStatus, setAuthStatus] = useState("loading"); // "loading" | "ok" | "none"
  const [lotteryNumber, setLotteryNumber] = useState(() => localStorage.getItem(STORAGE_KEYS.lotteryNumber) || "");
  const [participantName, setParticipantName] = useState(() => localStorage.getItem(STORAGE_KEYS.name) || "");

  const [showStampScan, setShowStampScan] = useState(Boolean((URL_BOOTH_ID && URL_BOOTH_SIG) || URL_TYPE));
  const [isTurnCompleted, setIsTurnCompleted] = useState(false);
  const [isFinishCompleted, setIsFinishCompleted] = useState(false);
  const [hasFinishPhoto, setHasFinishPhoto] = useState(false);
  const [adminPasswordOpen, setAdminPasswordOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [challengeCompleteOpen, setChallengeCompleteOpen] = useState(false);

  const completedStamps = useMemo(
    () => boothItems.filter((item) => stamps[item.booth_id]).length,
    [boothItems, stamps]
  );

  const handleChangeTab = useCallback((nextTab) => {
    setTab(nextTab);
    window.history.replaceState(null, "", `#${nextTab}`);
  }, []);

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
          setIsTurnCompleted(Boolean(me.isTurnCompleted));
          setIsFinishCompleted(Boolean(me.isFinishCompleted));
          setHasFinishPhoto(Boolean(me.hasFinishPhoto));
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

  // 새로고침 등으로 해시가 "#finishPhoto"로 복원됐지만 접근 조건(완주 인증 + 사진 등록)이
  // 아직 충족되지 않은 경우(세션 만료, 사진 미등록 등) 홈 탭으로 되돌린다.
  useEffect(() => {
    if (tab !== "finishPhoto" || authStatus === "loading") return;
    if (authStatus !== "ok" || !isFinishCompleted || !hasFinishPhoto) {
      handleChangeTab("home");
    }
  }, [tab, authStatus, isFinishCompleted, hasFinishPhoto, handleChangeTab]);

  // 해시가 "#stamp"로 진입했지만 로그인 세션이 없는 경우(비회원 URL 직접 접근/새로고침),
  // 도장판 콘텐츠가 비어 보이는 대신 홈 탭으로 되돌린다.
  useEffect(() => {
    if (tab !== "stamp" || authStatus === "loading") return;
    if (authStatus !== "ok") {
      handleChangeTab("home");
    }
  }, [tab, authStatus, handleChangeTab]);

  async function handleLoginSubmit({ name, phone }) {
    const { isNew, lotteryNumber: newLotteryNumber } = await registerOrLogin(name, phone);
    setParticipantName(name);
    setLotteryNumber(newLotteryNumber);
    localStorage.setItem(STORAGE_KEYS.name, name);
    localStorage.setItem(STORAGE_KEYS.lotteryNumber, newLotteryNumber);
    if (!isNew) {
      setAuthStatus("ok");
    }
    return { isNew, lotteryNumber: newLotteryNumber };
  }

  function handleLoginClose() {
    setLoginModalOpen(false);
    // DoneStep "시작하기" 또는 기존 사용자 로그인 완료 후 호출
    if (participantName) setAuthStatus("ok");
  }

  async function handleLogout() {
    await logout();
    localStorage.removeItem(STORAGE_KEYS.name);
    localStorage.removeItem(STORAGE_KEYS.lotteryNumber);
    localStorage.removeItem(STORAGE_KEYS.stamps);
    setParticipantName("");
    setLotteryNumber("");
    setStamps({});
    setAuthStatus("none");
    setTab("home");
  }

  function handleStampDone({ status, mode, boothId, checkpointType }) {
    if (status === "success" && mode === "checkpoint" && checkpointType) {
      if (checkpointType === "turn") setIsTurnCompleted(true);
      if (checkpointType === "finish") {
        setIsFinishCompleted(true);
        setHasFinishPhoto(true);
      }
    } else if (status === "success" && boothId) {
      setStamps((prev) => {
        if (prev[boothId]) return prev; // 이미 인증된 부스면 카운트 중복 방지
        const next = { ...prev, [boothId]: true };
        localStorage.setItem(STORAGE_KEYS.stamps, JSON.stringify(next));
        // 챌린지 완료 기준(CHALLENGE_COMPLETE_STAMP_COUNT) 도달 시점에만 챌린지 완료 팝업 노출
        const newCompletedCount = boothItems.filter((item) => next[item.booth_id]).length;
        if (newCompletedCount === CHALLENGE_COMPLETE_STAMP_COUNT) {
          setChallengeCompleteOpen(true);
        }
        return next;
      });
    }
    setShowStampScan(false);
    window.history.replaceState({}, "", "/");
    // 반환점 미인증 안내 화면 및 캠페인 미참여 안내 화면의 확인 버튼 클릭 시 홈 탭으로 이동
    const isHomeBound = status === "home" || status === "not_participating";
    handleChangeTab(isHomeBound ? "home" : "stamp");
    if (status === "not_participating") {
      // 홈 탭 렌더링(참여 버튼 등) 이후 화면 가장 아래 영역으로 스크롤 이동
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  }

  return (
    <div className="min-h-screen pb-28 text-ink">
      {showAdmin && <AdminPage onExit={() => setShowAdmin(false)} />}

      <ChallengeCompleteModal open={challengeCompleteOpen} onClose={() => setChallengeCompleteOpen(false)} />

      {!showAdmin && (
        <>
          <header className="mx-auto w-full max-w-[30rem] px-4 pt-6 md:max-w-4xl md:px-6">
            <div className="soft-card relative overflow-hidden p-4 md:p-7">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#06539D]/25 opacity-70" />
              <div className="absolute -bottom-12 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-limeCloud opacity-80" />
              <p className="text-sm font-semibold tracking-wide text-[#61718a]">세계자살예방의 날 · 9월 13일</p>
              <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">사람사랑 생명사랑 걷기캠페인</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4e5f75] md:text-base">
                따뜻한 걸음으로 생명의 소중함을 전하는 참여형 축제입니다. 부스 미션과 걷기 인증을 완료하고,
                희망의 메시지를 함께 나눠 보세요.
              </p>

              <SurveyBanner
                className="mt-4"
                message={<>📝 캠페인 설문조사에 참여하고<br/>소중한 의견을 들려주세요!</>}
              />
            </div>
          </header>

          <main className="mx-auto mt-6 w-full max-w-[30rem] space-y-6 px-4 md:max-w-4xl md:px-6">
            {tab === "home" && (
              <HomeSection
                lotteryNumber={lotteryNumber}
                participantName={participantName}
                onAdminClick={() => setAdminPasswordOpen(true)}
                onLogout={handleLogout}
                onLoginClick={() => setLoginModalOpen(true)}
              />
            )}
            {tab === "stamp" && authStatus === "ok" && (
              <StampCardSection
                boothItems={boothItems}
                stamps={stamps}
                completedStamps={completedStamps}
                isTurnCompleted={isTurnCompleted}
                isFinishCompleted={isFinishCompleted}
                challengeCompleteStampCount={CHALLENGE_COMPLETE_STAMP_COUNT}
              />
            )}
            {tab === "finishPhoto" && authStatus === "ok" && isFinishCompleted && hasFinishPhoto && (
              <FinishPhotoSection />
            )}
          </main>

          <BottomNav
            tab={tab}
            onChangeTab={handleChangeTab}
            isAuthenticated={authStatus === "ok"}
            showFinishPhotoTab={isFinishCompleted && hasFinishPhoto}
          />

          {showStampScan && ((URL_BOOTH_ID && URL_BOOTH_SIG) || URL_TYPE) && (
            <StampScanPage
              mode={URL_TYPE ? "checkpoint" : "booth"}
              boothId={URL_BOOTH_ID}
              boothSig={URL_BOOTH_SIG}
              boothTitle={boothItems.find((b) => b.booth_id === URL_BOOTH_ID)?.title}
              checkpointType={URL_TYPE}
              authStatus={authStatus}
              onDone={handleStampDone}
            />
          )}

          <LoginModal
            open={loginModalOpen}
            onSubmit={handleLoginSubmit}
            onClose={handleLoginClose}
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
