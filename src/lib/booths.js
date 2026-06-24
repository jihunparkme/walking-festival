import { supabase } from "./supabase";

/** booths 테이블에서 부스 목록을 등록순으로 조회 */
export async function fetchBooths() {
  const { data, error } = await supabase
    .from("booths")
    .select("id, booth_id, title, subtitle")
    .order("title", { ascending: true });

  if (error) throw new Error("부스 정보를 불러오는 중 오류가 발생했습니다.");
  return data;
}
