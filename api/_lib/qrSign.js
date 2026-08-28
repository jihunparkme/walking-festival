import { createHmac, timingSafeEqual } from "node:crypto";

// QR 코드 서명 길이(hex 문자 수) — 16바이트(32 hex)면 충돌/위조 방지에 충분하면서도 URL이 짧습니다.
const SIG_LENGTH = 32;

/**
 * booth_id를 서버 비밀키(QR_SECRET)로 서명합니다.
 * 개별 부스 무효화가 필요 없는 대신, 전체 QR을 한 번에 무효화하려면 QR_SECRET을 교체하면 됩니다.
 */
export function signBoothId(boothId, secret) {
  return createHmac("sha256", secret).update(boothId).digest("hex").slice(0, SIG_LENGTH);
}

/** URL에서 받은 서명이 booth_id에 대한 올바른 서명인지 타이밍 세이프하게 검증합니다. */
export function verifyBoothSig(boothId, sig, secret) {
  if (!boothId || !sig || typeof sig !== "string" || sig.length !== SIG_LENGTH) return false;
  const expected = signBoothId(boothId, secret);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
