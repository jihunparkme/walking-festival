import { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "./components/BottomNav";
import HomeSection from "./components/HomeSection";
import LoginModal from "./components/LoginModal";
import PasswordModal from "./components/PasswordModal";
import StampCardSection from "./components/StampCardSection";
import WalkCertifySection from "./components/WalkCertifySection";
import { stampItems } from "./data/stamps";
import { getToken, registerOrLogin, saveToken } from "./lib/auth";

const STORAGE_KEYS = {
  stamps: "walkingFestival.stamps",
  steps: "walkingFestival.steps",
  photo: "walkingFestival.photo",
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

function haversineMeters(prev, next) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(next.latitude - prev.latitude);
  const dLng = toRad(next.longitude - prev.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(prev.latitude)) * Math.cos(toRad(next.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [stamps, setStamps] = useState(() => readJSON(STORAGE_KEYS.stamps, {}));
  const [steps, setSteps] = useState(() => Number(localStorage.getItem(STORAGE_KEYS.steps) || 0));
  const [photoDataUrl, setPhotoDataUrl] = useState(() => localStorage.getItem(STORAGE_KEYS.photo) || "");

  const [loginModalOpen, setLoginModalOpen] = useState(() => !getToken());

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [geoEnabled, setGeoEnabled] = useState(false);
  const [geoStatus, setGeoStatus] = useState("위치 권한을 허용하면 실제 이동 기반 걸음 수가 기록됩니다.");

  const previousPositionRef = useRef(null);
  const watchIdRef = useRef(null);

  const completedStamps = useMemo(
    () => stampItems.filter((item) => stamps[item.id]).length,
    [stamps]
  );

  useEffect(() => {
    // 도장 상태를 자동 저장해 새로고침 이후에도 유지한다.
    localStorage.setItem(STORAGE_KEYS.stamps, JSON.stringify(stamps));
  }, [stamps]);

  useEffect(() => {
    // 누적 걸음 수를 기기 저장소에 동기화한다.
    localStorage.setItem(STORAGE_KEYS.steps, String(steps));
  }, [steps]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

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

  function openLocationSettings() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(ua)) {
      alert("안드로이드: 설정 > 앱 > 해당 앱 > 권한 > 위치에서 직접 허용해 주세요.");
      return;
    }
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.userAgentData && navigator.userAgentData.platform === 'ios')) {
      alert("iOS: 설정 > 개인정보 보호 및 보안 > 위치 서비스 > 브라우저(또는 앱)에서 위치 권한을 허용해 주세요.");
      return;
    }
    // 데스크톱(크롬 등)만 지원 페이지로 연결
    window.open("https://support.google.com/chrome/answer/142065?hl=ko", "_blank", "noopener,noreferrer");
  }

  function startGeolocation() {
    if (!navigator.geolocation) {
      setGeoStatus("이 브라우저에서는 위치 기능을 지원하지 않습니다. 시뮬레이션 모드를 사용해 주세요.");
      return;
    }
    if (watchIdRef.current !== null) {
      setGeoStatus("이미 위치 측정 중입니다.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGeoEnabled(true);
        setGeoStatus("실시간 이동을 추적하는 중입니다.");

        const current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        // 위치 좌표 간 실제 거리(m)를 걸음 수로 변환해 누적 저장한다.
        if (previousPositionRef.current) {
          const distance = haversineMeters(previousPositionRef.current, current);
          const stepIncrement = Math.floor(distance / 0.75);
          if (stepIncrement > 0) {
            setSteps((prev) => prev + stepIncrement);
          }
        }
        previousPositionRef.current = current;
      },
      (error) => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        setGeoEnabled(false);

        if (error.code === 1) {
          setGeoStatus("위치 권한이 거부되었습니다. 아래 버튼으로 기기/브라우저 설정에서 위치 권한을 다시 허용해 주세요.");
          return;
        }

        if (error.code === 2) {
          setGeoStatus("현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }

        if (error.code === 3) {
          setGeoStatus("위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.");
          return;
        }

        setGeoStatus("위치 측정을 시작할 수 없습니다. 시뮬레이션 모드를 사용해 주세요.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );
  }

  function stopGeolocation() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      previousPositionRef.current = null;
      setGeoStatus("위치 추적을 중지했습니다.");
    }
  }

  function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // 업로드 이미지를 Data URL로 변환해 재접속 후에도 localStorage로 복원한다.
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setPhotoDataUrl(result);
      localStorage.setItem(STORAGE_KEYS.photo, result);
    };
    reader.readAsDataURL(file);
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

        {tab === "walk" && (
          <WalkCertifySection
            steps={steps}
            geoStatus={geoStatus}
            geoEnabled={geoEnabled}
            onStartGeolocation={startGeolocation}
            onOpenLocationSettings={openLocationSettings}
            onStopGeolocation={stopGeolocation}
            onPhotoUpload={handlePhotoUpload}
            photoDataUrl={photoDataUrl}
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
