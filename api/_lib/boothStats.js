import { signBoothId } from "./qrSign.js";

/**
 * 부스 목록에 참여 인원 수(participant_count)와 QR 서명(qr_sig)을 붙여 반환합니다.
 * `api/admin/booths.js`와 `vite.config.js`(로컬 개발용 미들웨어)에서 동일하게 사용해
 * 두 곳의 매핑 로직이 어긋나지 않도록 합니다.
 */
export function mapBoothsWithStats(boothsData, stampData, secret) {
  const countMap = (stampData ?? []).reduce((acc, r) => {
    acc[r.booth_id] = (acc[r.booth_id] ?? 0) + 1;
    return acc;
  }, {});

  return boothsData.map((b) => ({
    ...b,
    participant_count: countMap[b.booth_id] ?? 0,
    // 관리 화면에서 QR 링크(/stamp?booth=...&sig=...)를 바로 만들어 보여주기 위한 서명
    qr_sig: signBoothId(b.booth_id, secret),
  }));
}
