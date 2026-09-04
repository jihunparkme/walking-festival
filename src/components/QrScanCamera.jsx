import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * 기기 카메라를 이용해 QR 코드를 앱 안에서 바로 스캔하는 전체 화면 오버레이입니다.
 * 매번 별도의 사진(카메라) 앱을 실행해 QR을 찍고 링크로 재진입해야 하는 번거로움을 없애기 위해,
 * "도장판" 카드 클릭 시 이 컴포넌트를 띄워 카메라 프리뷰 위에서 바로 QR을 인식합니다.
 *
 * @param {string}   title   - 스캔 대상 안내 문구(부스명/체크포인트명 등)
 * @param {Function} onScan  - 디코딩된 QR 문자열을 전달받아 유효 여부(boolean)를 반환해야 합니다.
 *                             true를 반환하면 스캔을 멈추고 오버레이가 닫힐 준비를 합니다.
 * @param {Function} onClose - 취소(닫기) 버튼 클릭 시 호출됩니다.
 */
export default function QrScanCamera({ title, onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastDataRef = useRef("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");

    function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        // 동일한 QR을 프레임마다 반복 처리하지 않도록 마지막으로 처리한 값과 비교
        if (code && code.data && code.data !== lastDataRef.current) {
          lastDataRef.current = code.data;
          const accepted = onScan(code.data);
          if (accepted) {
            return; // 스캔 성공 — 부모가 오버레이를 닫을 때까지 프레임 처리 중단
          }
          setError("유효하지 않은 QR 코드입니다. 다시 시도해 주세요.");
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        if (!cancelled) {
          setError("카메라를 사용할 수 없습니다. 브라우저의 카메라 권한을 허용해 주세요.");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/95 px-6 text-center text-white">
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-lg font-bold"
      >
        ✕
      </button>

      <h2 className="text-lg font-extrabold">{title ? `${title} QR 인증` : "QR 인증"}</h2>
      <p className="mt-1 text-xs text-white/70">부스에 비치된 QR 코드를 카메라 화면에 비춰주세요.</p>

      <div className="relative mt-5 h-72 w-72 max-w-full overflow-hidden rounded-3xl border-4 border-white/40">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <button
        type="button"
        onClick={onClose}
        className="mt-6 rounded-bubble border border-white/30 px-6 py-2 text-sm font-bold text-white"
      >
        취소
      </button>
    </div>
  );
}
