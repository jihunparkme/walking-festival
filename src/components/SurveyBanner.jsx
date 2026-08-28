import { SURVEY_URL } from "../lib/constants";

/**
 * 캠페인 설문조사(Google Forms) 참여를 유도하는 배너.
 * 메인 페이지 헤더, 반환점 인증 완료 화면 등 여러 위치에서 재사용된다.
 *
 * @param {string} message           - 배너에 노출할 안내 문구 (문자열 또는 JSX)
 * @param {string} className         - 배너 컨테이너에 추가할 유틸리티 클래스 (예: 여백, 너비)
 * @param {string} badgeClassName    - "설문 참여하기" 배지에 추가/오버라이드할 유틸리티 클래스
 */
export default function SurveyBanner({ message, className = "", badgeClassName = "bg-white/70" }) {
  return (
    <a
      href={SURVEY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative z-10 flex items-center justify-between gap-3 rounded-bubble bg-creamSun p-4 text-[#5b4a1f] transition hover:brightness-95 ${className}`}
    >
      <span className="text-sm font-bold md:text-base">{message}</span>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badgeClassName}`}>설문 참여하기</span>
    </a>
  );
}
