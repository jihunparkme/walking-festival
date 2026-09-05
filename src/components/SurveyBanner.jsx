import { SURVEY_URL } from "../lib/constants";

/**
 * 캠페인 설문조사(Google Forms) 참여를 유도하는 배너.
 * 메인 페이지 헤더, 반환점 인증 완료 화면 등 여러 위치에서 재사용된다.
 *
 * @param {string} message           - 배너에 노출할 안내 문구 (문자열 또는 JSX). "설문 참여하기" 배지와 한 줄에 표시된다.
 * @param {string} note              - message 아래 별도 줄에 표시할 부가 안내 문구 (예: 상품 안내)
 * @param {string} className         - 배너 컨테이너에 추가할 유틸리티 클래스 (예: 여백, 너비)
 * @param {string} badgeClassName    - "설문 참여하기" 배지에 추가/오버라이드할 유틸리티 클래스
 */
export default function SurveyBanner({ message, note, className = "", badgeClassName = "bg-primary text-white" }) {
  return (
    <a
      href={SURVEY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative z-10 block overflow-hidden rounded-bubble border border-black/5 bg-gradient-to-r from-skyMint to-limeCloud p-4 text-ink shadow-soft backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold leading-snug tracking-tight md:text-base">{message}</span>
        <span
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm transition duration-200 group-hover:brightness-110 group-active:brightness-95 ${badgeClassName}`}
        >
          설문 참여하기
        </span>
      </div>
      {note && <p className="mt-2 text-xs font-semibold leading-relaxed text-ink/80">{note}</p>}
    </a>
  );
}
