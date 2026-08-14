import { useEffect, useRef, useState } from "react";
import { fetchFinishPhotoUrl } from "../lib/finishPhoto";

/**
 * 완주 인증 사진 조회 탭.
 * 완주 인증(finish) + 사진 등록까지 완료한 참여자만 진입할 수 있는 메뉴이며,
 * 진입 시 서버에서 서명된 URL(private 버킷, 임시 유효)을 받아와 사진을 보여준다.
 * 서명된 URL은 유효 시간(10분)이 있어, 탭을 오래 켜둔 채 만료되면 이미지 로드가
 * 실패할 수 있다 — 최초 1회는 자동으로 새 URL을 재발급받아 조용히 복구를 시도한다.
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
    <section className="soft-card p-4 md:p-7">
      <h2 className="text-xl font-bold">완주 인증 사진</h2>
      <p className="mt-1 text-sm text-[#5b6c84]">등록하신 완주 인증 사진을 확인할 수 있습니다.</p>

      <div className="mt-5 flex flex-col items-center justify-center">
        {status === "loading" && (
          <p className="py-10 text-sm text-[#8a9ab5]">사진을 불러오는 중…</p>
        )}
        {status === "error" && (
          <>
            <p className="py-4 text-sm text-red-500">{errorMsg}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-bubble bg-[#1d4ed8] px-5 py-2 text-sm font-bold text-white"
            >
              다시 시도
            </button>
          </>
        )}
        {status === "ready" && (
          <img
            src={photoUrl}
            alt="완주 인증 사진"
            className="max-h-[28rem] w-full max-w-sm rounded-bubble object-cover shadow-soft"
            onError={handleImageError}
          />
        )}
      </div>
    </section>
  );
}
