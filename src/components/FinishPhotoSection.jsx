import { useEffect, useRef, useState } from "react";
import { fetchFinishPhotoUrl } from "../lib/finishPhoto";
import finishStampSeal from "../assets/finish-stamp-seal.png";
import finishBackground from "../assets/images/background.png";

// 캠페인 고정 정보 (매년 동일 일자에 진행되는 단일 행사이므로 하드코딩)
const FINISH_LOCATION = "평촌중앙공원 일대";
const FINISH_DATE = "2026.09.13 (일)";

/**
 * 완보 인증 사진 조회 탭.
 * 완보 인증(finish) + 사진 등록까지 완료한 참여자만 진입할 수 있는 메뉴이며,
 * 진입 시 서버에서 서명된 URL(private 버킷, 임시 유효)을 받아와 사진을 보여준다.
 * 서명된 URL은 유효 시간(10분)이 있어, 탭을 오래 켜둔 채 만료되면 이미지 로드가
 * 실패할 수 있다 — 최초 1회는 자동으로 새 URL을 재발급받아 조용히 복구를 시도한다.
 * 참여자가 캡쳐해 SNS 등에 공유하기 쉽도록 캠페인명·완주 인증 요소를 카드 형태로 강조한다.
 */
export default function FinishPhotoSection() {
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [photoUrl, setPhotoUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const autoRetriedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchFinishPhotoUrl()
      .then((url) => {
        if (cancelled) return;
        setPhotoUrl(url);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err.message || "사진을 불러오는 중 오류가 발생했습니다.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  function handleRetry() {
    autoRetriedRef.current = false;
    setRetryCount((n) => n + 1);
  }

  // 서명된 URL 만료 등으로 이미지 로드가 실패하면, 최초 1회에 한해 새 URL을
  // 자동으로 재요청해 조용히 복구를 시도하고, 그래도 실패하면 오류 화면으로 전환한다.
  function handleImageError() {
    if (autoRetriedRef.current) {
      setErrorMsg("사진을 불러오는 중 오류가 발생했습니다.");
      setStatus("error");
      return;
    }
    autoRetriedRef.current = true;
    setRetryCount((n) => n + 1);
  }

  return (
    <section
      className="soft-card relative overflow-hidden p-4 md:p-7"
      style={{
        backgroundImage: `url(${finishBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
      }}
    >
      <div className="absolute inset-0 bg-white/35" />
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#06539D]/20 opacity-70" />
      <div className="absolute -bottom-12 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-limeCloud opacity-80" />

      <div className="relative">
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-[#1F7A44] px-4 py-1.5 text-sm font-extrabold text-white shadow-soft">
          <span aria-hidden className="absolute -left-2 -top-2 text-xs">✨</span>
          👟 완보 인증
          <span aria-hidden className="absolute -right-2 -top-2 text-xs">✨</span>
        </span>
      </div>

      <p className="relative mt-4 text-base font-semibold leading-relaxed text-[#1a2a3a] md:text-lg">
        <span className="font-extrabold text-[#06539D]">제15회 사람사랑 생명사랑 걷기캠페인</span>에
        참여하여, 소중한 걸음을 <span className="font-extrabold text-[#E94D83]">완주</span>했습니다! ♡
      </p>

      <div className="relative mt-5 flex flex-col items-center justify-center">
        {status === "loading" && (
          <p className="py-10 text-sm text-[#8a9ab5]">사진을 불러오는 중…</p>
        )}
        {status === "error" && (
          <>
            <p className="py-4 text-sm text-red-500">{errorMsg}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-bubble bg-[#05437E] px-5 py-2 text-sm font-bold text-white"
            >
              다시 시도
            </button>
          </>
        )}
        {status === "ready" && (
          <div className="relative w-full max-w-sm rounded-bubble border-4 border-white bg-white p-2 shadow-soft ring-1 ring-black/5">
            <div className="relative overflow-hidden rounded-[1.4rem]">
              <img
                src={photoUrl}
                alt="완보 인증 사진"
                className="max-h-[28rem] w-full object-cover"
                onError={handleImageError}
              />
              {/* 손글씨 스타일 응원 문구 오버레이 */}
              <p
                className="handwriting pointer-events-none absolute left-4 top-4 max-w-[75%] text-lg leading-snug text-white [-webkit-text-stroke:1.2px_black] [paint-order:stroke_fill] md:text-xl"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
              >
                오늘,
                <br />
                함께 걸은 걸음이
                <br />
                생명을 지키는
                <br />
                희망이 됩니다 ♡
              </p>
              {/* 하단 장소/일시 정보 오버레이 */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-3 pt-10 text-white">
                <p className="flex items-center gap-1.5 text-sm font-semibold [-webkit-text-stroke:1px_black] [paint-order:stroke_fill]">
                  <span aria-hidden>📍</span> {FINISH_LOCATION}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold [-webkit-text-stroke:1px_black] [paint-order:stroke_fill]">
                  <span aria-hidden>🗓️</span> {FINISH_DATE}
                </p>
              </div>
            </div>
            {/* 완보 인증 스탬프 스티커: 사진 우측 상단 모서리에 걸쳐 보이도록 배치 */}
            <img
              src={finishStampSeal}
              alt="LIFE WALKING 완보 스탬프"
              className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rotate-[8deg] drop-shadow-lg md:h-28 md:w-28"
            />
          </div>
        )}
      </div>

      {status === "ready" && (
        <div className="relative mx-auto mt-5 flex max-w-sm items-center gap-3 rounded-bubble bg-limeCloud/70 px-4 py-3 text-sm font-semibold text-[#2e5b3f] backdrop-blur-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-soft">💚</span>
          <p className="flex-1">함께한 걸음이 더 많은 생명을 살리는 시작입니다 😊</p>
          {/* 발자국 장식 (이모지 대신 SVG로 렌더링해 기기/폰트에 관계없이 브랜드 컬러 유지) */}
          <svg
            aria-hidden
            viewBox="0 0 60 30"
            className="h-6 w-12 shrink-0 text-[#1F7A44]/60"
            fill="currentColor"
          >
            <g transform="translate(0,12) rotate(-8)">
              <ellipse cx="6" cy="6" rx="4" ry="6" />
              <circle cx="3" cy="-1" r="1.6" />
              <circle cx="6.5" cy="-2.4" r="1.5" />
              <circle cx="9.5" cy="-1.6" r="1.3" />
            </g>
            <g transform="translate(20,2) rotate(6)">
              <ellipse cx="6" cy="6" rx="4" ry="6" />
              <circle cx="3" cy="-1" r="1.6" />
              <circle cx="6.5" cy="-2.4" r="1.5" />
              <circle cx="9.5" cy="-1.6" r="1.3" />
            </g>
            <g transform="translate(38,14) rotate(-4)">
              <ellipse cx="6" cy="6" rx="4" ry="6" />
              <circle cx="3" cy="-1" r="1.6" />
              <circle cx="6.5" cy="-2.4" r="1.5" />
              <circle cx="9.5" cy="-1.6" r="1.3" />
            </g>
          </svg>
        </div>
      )}
    </section>
  );
}
