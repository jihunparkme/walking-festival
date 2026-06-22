import { supabase } from "./supabase";

const TOKEN_COOKIE_KEY = "wf_token";
const TOKEN_COOKIE_DAYS = 180;

/**
 * 신규 사용자 등록 또는 기존 사용자 재로그인.
 * - 전화번호 기준으로 중복 체크
 * - 신규: DB 저장 후 토큰 반환
 * - 기존: 이름이 일치하면 저장된 토큰 반환 (재접속 처리)
 * @returns {{ token: string, isNew: boolean }}
 */
export async function registerOrLogin(name, phone) {
  const { data: existing, error: fetchError } = await supabase
    .from("participants")
    .select("name, token, id")
    .eq("phone", phone)
    .maybeSingle();

  if (fetchError) throw new Error("서버 조회 중 오류가 발생했습니다.");

  // 기존 사용자
  if (existing) {
    if (existing.name !== name) {
      throw new Error("입력하신 이름이 기존 등록 정보와 일치하지 않습니다.");
    }
    return { token: existing.token, participantId: existing.id, isNew: false };
  }

  // 신규 사용자
  const { data: inserted, error: insertError } = await supabase
    .from("participants")
    .insert({ name, phone })
    .select("id, token")
    .single();

  if (insertError) throw new Error("참여자 등록 중 오류가 발생했습니다.");

  return { token: inserted.token, participantId: inserted.id, isNew: true };
}

/** 토큰을 localStorage 와 Cookie 에 함께 저장 */
export function saveToken(token) {
  localStorage.setItem("walkingFestival.userToken", token);

  const expires = new Date();
  expires.setDate(expires.getDate() + TOKEN_COOKIE_DAYS);
  document.cookie = `${TOKEN_COOKIE_KEY}=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/** localStorage 또는 Cookie 에서 토큰 반환 */
export function getToken() {
  const fromStorage = localStorage.getItem("walkingFestival.userToken");
  if (fromStorage) return fromStorage;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${TOKEN_COOKIE_KEY}=`));
  return match ? match.split("=")[1] : null;
}
