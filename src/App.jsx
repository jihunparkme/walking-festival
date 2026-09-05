import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminPage from "./components/AdminPage";
import AdminPasswordModal from "./components/AdminPasswordModal";
import BottomNav from "./components/BottomNav";
import ChallengeCompleteModal from "./components/ChallengeCompleteModal";
import HomeSection from "./components/HomeSection";
import LoginModal from "./components/LoginModal";
import FinishPhotoSection from "./components/FinishPhotoSection";
import QrScanCamera from "./components/QrScanCamera";
import StampCardSection from "./components/StampCardSection";
import StampScanPage from "./components/StampScanPage";
import SurveyBanner from "./components/SurveyBanner";
import { fetchMe, logout, registerOrLogin } from "./lib/auth";
import { fetchBooths } from "./lib/booths";
import { fetchMyStamps } from "./lib/stamps";

// 새로고침 순간 화면 깜빡임을 줄이기 위한 초기값 전용 캐시.
// 추첨번호/이름은 등록 시점에 정해지면 서버에서 수정/삭제할 수단이 없어(참여자 관리 API는
// 조회(GET)만 지원) 캐시가 서버 값과 어긋날 일이 없다. 다만 이 값은 "초기 표시값"으로만
// 쓰이며, fetchMe() 응답이 도착하면 항상 그 값으로 덮어써 서버가 최종 권위를 갖는다.
// (반면 stamps는 관리자가 부스를 삭제하면 서버 값이 바뀔 수 있어 캐싱하지 않는다.)
const STORAGE_KEYS = {
  lotteryNumber: "walkingFestival.lotteryNumber",
  name: "walkingFestival.name",
};

// 챌린지 완료 기준 부스 참여 개수 (전체 부스 개수와 무관하게 최소 5개 참여 시 완료)
const CHALLENGE_COMPLETE_STAMP_COUNT = 5;
// 미션 부스가 아니라 경품 수령 여부만 확인하는 전용 도장이므로 챌린지 카운트에서 제외
const PRIZE_CHECK_BOOTH_ID = "완료확인";

/**
 * 경품 수령 확인 도장(PRIZE_CHECK_BOOTH_ID)을 제외하고, 실제 챌린지 카운트에 반영되는
 * 완료 도장 개수를 계산합니다.
 */
function countCompletedStamps(boothItems, stampsObj) {
  return boothItems.filter(
    (item) => item.booth_id !== PRIZE_CHECK_BOOTH_ID && stampsObj[item.booth_id]
  ).length;
}

// /stamp?booth=xxx&sig=yyy (부스 QR, booth_id + 서버 서명) 또는 /stamp?type=turn|finish URL인지 감지 (컴포넌트 바깥에서 한 번만 읽음)
const urlParams = new URLSearchParams(window.location.search);
const isStampPath = window.location.pathname === "/stamp";
const URL_BOOTH_ID = isStampPath ? urlParams.get("booth") : null;
const URL_BOOTH_SIG = isStampPath ? urlParams.get("sig") : null;
const URL_CHECKPOINT_TYPE = isStampPath ? urlParams.get("type") : null;
const VALID_CHECKPOINT_TYPES = ["turn", "finish"];
const CHECKPOINT_TITLES = { turn: "반환점", finish: "완주" };
const URL_TYPE = VALID_CHECKPOINT_TYPES.includes(URL_CHECKPOINT_TYPE) ? URL_CHECKPOINT_TYPE : null;

if ((URL_BOOTH_ID && URL_BOOTH_SIG) || URL_TYPE) {
  window.history.replaceState({}, "", "/");
}

/**
 * 앱 내 카메라로 스캔한 QR 문자열이 유효한 도장/체크포인트 인증 링크(/stamp?...)인지 확인하고,
 * 부스 인증 또는 반환점/완주 인증에 필요한 정보를 추출합니다. 유효하지 않으면 null을 반환합니다.
 */
function parseStampQrText(text) {
  try {
    const url = new URL(text, window.location.origin);
    if (url.pathname !== "/stamp") return null;
    const params = url.searchParams;
    const boothId = params.get("booth");
    const boothSig = params.get("sig");
    if (boothId && boothSig) return { mode: "booth", boothId, boothSig };
    const type = params.get("type");
    if (VALID_CHECKPOINT_TYPES.includes(type)) return { mode: "checkpoint", checkpointType: type };
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    return hash === "stamp" || hash === "finishPhoto" ? hash : "home";
  });
  // 도장은 로컬 캐시(localStorage) 없이 항상 서버(fetchMe, fetchMyStamps)를
  // 단일 진실 공급원(source of truth)으로 사용한다. 로그인 세션 확인 전까지는 빈 값으로 시작한다.
  const [stamps, setStamps] = useState({});
  const [boothItems, setBoothItems] = useState([]);
  // handleStampDone은 실물 QR 스캔(카메라 앱)으로 진입한 StampScanPage의 useEffect(의존성
  // 배열에 onDone 미포함)에서 한 번 캡처된 뒤 재사용될 수 있어, 그 시점의 boothItems가
  // 아직 빈 배열(fetchBooths 응답 전)이면 챌린지 완료 카운트가 항상 0으로 계산되어 팝업이
  // 영영 노출되지 않는 문제가 있었다. ref로 최신 boothItems를 항상 읽도록 해 이를 방지한다.
  const boothItemsRef = useRef(boothItems);

  // 세션: 서버에서 확인, 로딩 중에는 undefined
  const [authStatus, setAuthStatus] = useState("loading"); // "loading" | "ok" | "none"
  // 추첨번호/이름은 새로고침 시 깜빡임 방지용 초기값으로만 로컬 캐시를 읽고,
  // fetchMe() 응답이 도착하면 아래 useEffect에서 서버 값으로 덮어쓴다.
  const [lotteryNumber, setLotteryNumber] = useState(() => localStorage.getItem(STORAGE_KEYS.lotteryNumber) || "");
  const [participantName, setParticipantName] = useState(() => localStorage.getItem(STORAGE_KEYS.name) || "");

  const [showStampScan, setShowStampScan] = useState(Boolean((URL_BOOTH_ID && URL_BOOTH_SIG) || URL_TYPE));
  // 실제 스캔 대상 정보: 최초 진입은 물리 QR을 OS 카메라 앱으로 찍어 이동한 URL 값으로 초기화되고,
  // 이후에는 앱 내 카메라 스캔(QrScanCamera) 결과로도 갱신됩니다.
  const [stampBoothId, setStampBoothId] = useState(URL_BOOTH_ID);
  const [stampBoothSig, setStampBoothSig] = useState(URL_BOOTH_SIG);
  const [stampCheckpointType, setStampCheckpointType] = useState(URL_TYPE);
  // 도장판에서 카드를 클릭했을 때 열리는 앱 내 QR 카메라 스캔 오버레이 상태
  const [cameraScan, setCameraScan] = useState(null); // { title } | null
  const [isTurnCompleted, setIsTurnCompleted] = useState(false);
  const [isFinishCompleted, setIsFinishCompleted] = useState(false);
  const [hasFinishPhoto, setHasFinishPhoto] = useState(false);
  const [adminPasswordOpen, setAdminPasswordOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginMode, setLoginMode] = useState("register"); // "register"(신규 참여) | "login"(기존 참여자 로그인)
  const [challengeCompleteOpen, setChallengeCompleteOpen] = useState(false);

  const completedStamps = useMemo(
    () => countCompletedStamps(boothItems, stamps),
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

  useEffect(() => {
    boothItemsRef.current = boothItems;
  }, [boothItems]);

  // 앱 시작 시 HttpOnly 쿠키로 세션 확인
  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (me) {
          // 캐시된 초기값이 있었더라도 서버 응답이 항상 최종 권위를 갖도록 덮어쓴다.
          setParticipantName(me.name);
          setLotteryNumber(me.lotteryNumber);
          localStorage.setItem(STORAGE_KEYS.name, me.name);
          localStorage.setItem(STORAGE_KEYS.lotteryNumber, me.lotteryNumber);
          setIsTurnCompleted(Boolean(me.isTurnCompleted));
          setIsFinishCompleted(Boolean(me.isFinishCompleted));
          setHasFinishPhoto(Boolean(me.hasFinishPhoto));
          setAuthStatus("ok");
        } else {
          // 쿠키 세션 없음 — 서버 기준 상태로 초기화하고 캐시도 함께 제거
          localStorage.removeItem(STORAGE_KEYS.name);
          localStorage.removeItem(STORAGE_KEYS.lotteryNumber);
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
    const { isNew, lotteryNumber: newLotteryNumber } = await registerOrLogin(name, phone, loginMode);
    setParticipantName(name);
    setLotteryNumber(newLotteryNumber);
    localStorage.setItem(STORAGE_KEYS.name, name);
    localStorage.setItem(STORAGE_KEYS.lotteryNumber, newLotteryNumber);
    if (!isNew) {
      setAuthStatus("ok");
    }
    return { isNew, lotteryNumber: newLotteryNumber };
  }

  function openRegisterModal() {
    setLoginMode("register");
    setLoginModalOpen(true);
  }

  function openReturningLoginModal() {
    setLoginMode("login");
    setLoginModalOpen(true);
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
    setParticipantName("");
    setLotteryNumber("");
    setStamps({});
    setAuthStatus("none");
    setTab("home");
  }

  function openBoothCameraScan(item) {
    setCameraScan({ title: item.title });
  }

  function openCheckpointCameraScan(checkpointType) {
    const label = CHECKPOINT_TITLES[checkpointType] || "체크포인트";
    setCameraScan({ title: label });
  }

  // QrScanCamera가 디코딩한 QR 문자열을 검증하고, 유효하면 인증 처리 화면(StampScanPage)을 연다.
  // 반환값은 QrScanCamera에 유효성 여부를 알려 스캔을 계속할지 판단하는 데 사용된다.
  function handleCameraScanResult(text) {
    const parsed = parseStampQrText(text);
    if (!parsed) return false;

    if (parsed.mode === "booth") {
      setStampBoothId(parsed.boothId);
      setStampBoothSig(parsed.boothSig);
      setStampCheckpointType(null);
    } else {
      setStampCheckpointType(parsed.checkpointType);
      setStampBoothId(null);
      setStampBoothSig(null);
    }
    setCameraScan(null);
    setShowStampScan(true);
    return true;
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
        // 서버(api/stamp.js)는 이미 도장이 있으면 409(duplicate)로 응답하고, status가
        // "success"로 전달되는 경우는 서버 기준으로 항상 신규 적립이다. 따라서 로컬
        // prev[boothId] 값으로 중복 여부를 재판단하지 않는다 — 로컬 캐시에 의존하면
        // 관리자가 부스를 삭제해 서버의 stamp_records가 초기화된 뒤 재시도로 신규 적립에
        // 성공해도 캐시 값 때문에 카운트 증가와 챌린지 완료 팝업 노출이 무시되는 문제가 있었다.
        const next = { ...prev, [boothId]: true };
        // 챌린지 완료 기준(CHALLENGE_COMPLETE_STAMP_COUNT) 도달 "시점"에 챌린지 완료 팝업 노출.
        // 카운트가 정확히 기준값과 일치할 때만 열면, 동기화 등으로 카운트가 기준값을
        // 건너뛰고 증가하는 경우(예: 4 -> 6) 팝업이 영영 노출되지 않으므로,
        // 기준값 미만 -> 이상으로 "전환"되는 시점을 감지해 노출한다.
        const prevCompletedCount = countCompletedStamps(boothItemsRef.current, prev);
        const newCompletedCount = countCompletedStamps(boothItemsRef.current, next);
        if (prevCompletedCount < CHALLENGE_COMPLETE_STAMP_COUNT && newCompletedCount >= CHALLENGE_COMPLETE_STAMP_COUNT) {
          setChallengeCompleteOpen(true);
        }
        return next;
      });
    }
    setShowStampScan(false);
    setStampBoothId(null);
    setStampBoothSig(null);
    setStampCheckpointType(null);
    window.history.replaceState({}, "", "/");
    // 반환점 미인증 안내 화면 및 캠페인 미참여 안내 화면의 확인 버튼 클릭 시 홈 탭으로 이동
    const isHomeBound = status === "home" || status === "not_participating";
    handleChangeTab(isHomeBound ? "home" : "stamp");
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
                따뜻한 걸음으로 생명의 소중함을 전하는 참여형 캠페인입니다. 부스 미션과 걷기 인증을 완료하고,
                희망의 메시지를 함께 나눠 보세요.
              </p>

              <SurveyBanner
                className="mt-4"
                message="📝 캠페인 설문조사에 참여하고 소중한 의견을 들려주세요!"
                note="*참여후 7번 만족도조사 부스에서 완료 화면을 보여주시면 소정의 상품을 드립니다."
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
                onLoginClick={openRegisterModal}
                onReturningLoginClick={openReturningLoginModal}
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
                onSelectBooth={openBoothCameraScan}
                onSelectCheckpoint={openCheckpointCameraScan}
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

          {showStampScan && ((stampBoothId && stampBoothSig) || stampCheckpointType) && (
            <StampScanPage
              mode={stampCheckpointType ? "checkpoint" : "booth"}
              boothId={stampBoothId}
              boothSig={stampBoothSig}
              boothTitle={boothItems.find((b) => b.booth_id === stampBoothId)?.title}
              checkpointType={stampCheckpointType}
              authStatus={authStatus}
              onDone={handleStampDone}
            />
          )}

          {cameraScan && (
            <QrScanCamera
              title={cameraScan.title}
              onScan={handleCameraScanResult}
              onClose={() => setCameraScan(null)}
            />
          )}

          <LoginModal
            open={loginModalOpen}
            mode={loginMode}
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
