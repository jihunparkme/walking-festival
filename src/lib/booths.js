import { supabase } from "./supabase";

/** booths 테이블에서 부스 목록을 sort_order 기준으로 조회 */
export async function fetchBooths() {
  const { data, error } = await supabase
    .from("booths")
    .select("id, title, subtitle")
    .order("sort_order", { ascending: true });

  if (error) throw new Error("부스 정보를 불러오는 중 오류가 발생했습니다.");
  return data;
}
