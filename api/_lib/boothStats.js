import { signBoothId } from "./qrSign.js";

/**
 * 부스별 도장 집계 결과(RPC get_booth_stamp_counts 반환 행 배열)를
 * { booth_id: count } 형태의 맵으로 변환합니다.
 */
export function toCountMap(countRows) {
  return (countRows ?? []).reduce((acc, r) => {
    acc[r.booth_id] = Number(r.participant_count);
    return acc;
  }, {});
}

/**
 * 부스 목록에 참여 인원 수(participant_count)와 QR 서명(qr_sig)을 붙여 반환합니다.
 * `api/admin/booths.js`와 `vite.config.js`(로컬 개발용 미들웨어)에서 동일하게 사용해
 * 두 곳의 매핑 로직이 어긋나지 않도록 합니다.
 *
 * 도장 집계는 stamp_records 전체를 가져와 JS에서 계산하지 않고, DB의
 * GROUP BY 집계 함수(get_booth_stamp_counts RPC)로 미리 집계된 countMap을 받아 사용합니다.
 */
export function mapBoothsWithStats(boothsData, countMap, secret) {
  return boothsData.map((b) => ({
    ...b,
    participant_count: countMap[b.booth_id] ?? 0,
    // 관리 화면에서 QR 링크(/stamp?booth=...&sig=...)를 바로 만들어 보여주기 위한 서명
    qr_sig: signBoothId(b.booth_id, secret),
  }));
}
