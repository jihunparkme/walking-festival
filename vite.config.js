import { createClient } from "@supabase/supabase-js";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/** 요청 바디를 문자열로 읽는 헬퍼 */
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf-8");
  try { return JSON.parse(raw); } catch { return {}; }
}

/** 관리자 비밀번호 검증 헬퍼 */
function checkAdmin(req, res, env) {
  const pw = req.headers["x-admin-password"];
  if (!pw || pw !== env.ADMIN_PASSWORD) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "인증이 필요합니다." }));
    return false;
  }
  return true;
}

/** 숫자만 입력했을 때 하이픈 포함 형식으로 변환 */
function formatPhone(s) {
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return null;
}

/** PostgREST .or() 필터에서 구조 조작 가능한 특수문자 제거 */
function escapeFilter(s) {
  return s.replace(/[%(),]/g, "");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      // 로컬 개발 전용: Vercel Serverless Function(/api/stamp)을 Vite 미들웨어로 대체
      {
        name: "local-stamp-api",
        configureServer(server) {
          // GET /api/stamps — token으로 도장 조회
          server.middlewares.use("/api/stamps", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "GET") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
            if (!token) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: "토큰이 필요합니다." }));
              return;
            }

            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

            const { data: participant, error: pError } = await supabase
              .from("participants")
              .select("id")
              .eq("token", token)
              .maybeSingle();

            if (pError || !participant) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: "유효하지 않은 토큰입니다." }));
              return;
            }

            const { data, error } = await supabase
              .from("stamp_records")
              .select("booth_id")
              .eq("participant_id", participant.id);

            if (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "도장 정보를 불러오는 중 오류가 발생했습니다." }));
              return;
            }

            const stamps = (data ?? []).reduce((acc, r) => ({ ...acc, [r.booth_id]: true }), {});
            res.statusCode = 200;
            res.end(JSON.stringify({ stamps }));
          });
          server.middlewares.use("/api/stamp", async (req, res) => {
            res.setHeader("Content-Type", "application/json");

            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            // 요청 바디 읽기
            let raw = "";
            for await (const chunk of req) raw += chunk;

            let token, boothId;
            try {
              ({ token, boothId } = JSON.parse(raw));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON" }));
              return;
            }

            if (!token || !boothId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "token과 boothId는 필수입니다." }));
              return;
            }

            const supabase = createClient(
              env.VITE_SUPABASE_URL,
              env.SUPABASE_SERVICE_ROLE_KEY
            );

            // 참여자 조회
            const { data: participant, error: pError } = await supabase
              .from("participants")
              .select("id")
              .eq("token", token)
              .maybeSingle();

            if (pError || !participant) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: "유효하지 않은 토큰입니다." }));
              return;
            }

            // 도장 INSERT — uq_participant_booth 제약이 중복을 막음
            const { error: insertError } = await supabase
              .from("stamp_records")
              .insert({ participant_id: participant.id, booth_id: boothId });

            if (insertError) {
              if (insertError.code === "23505") {
                res.statusCode = 409;
                res.end(JSON.stringify({ error: "이미 도장을 받은 부스입니다." }));
                return;
              }
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "도장 저장 중 오류가 발생했습니다." }));
              return;
            }

            res.statusCode = 201;
            res.end(JSON.stringify({ success: true, boothId, participantId: participant.id }));
          });
        },
      },

      // 로컬 개발 전용: 관리자 API 미들웨어
      {
        name: "local-admin-api",
        configureServer(server) {
          const PAGE_SIZE = 20;

          // POST /api/admin/auth — 비밀번호 검증
          server.middlewares.use("/api/admin/auth", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }
            const { password } = await readBody(req);
            if (!env.ADMIN_PASSWORD) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "관리자 비밀번호가 설정되지 않았습니다." }));
              return;
            }
            if (!password || password !== env.ADMIN_PASSWORD) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: "비밀번호가 올바르지 않습니다." }));
              return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          });

          // /api/admin/participants — GET(검색/페이지네이션)
          server.middlewares.use("/api/admin/participants", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (!checkAdmin(req, res, env)) return;
            if (req.method !== "GET") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            const url = new URL(req.url, "http://localhost");
            const search = url.searchParams.get("search") ?? "";
            const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
            const from = (page - 1) * PAGE_SIZE;

            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            let query = supabase
              .from("participants")
              .select("*", { count: "exact" })
              .order("id", { ascending: true })
              .range(from, from + PAGE_SIZE - 1);

            if (search.trim()) {
              const s = search.trim();
              const safe = escapeFilter(s);
              const filters = [`name.ilike.%${safe}%`, `phone.ilike.%${safe}%`];
              const formatted = formatPhone(s);
              if (formatted) filters.push(`phone.ilike.%${formatted}%`);
              query = query.or(filters.join(","));
            }

            const { data, error, count } = await query;
            if (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "참여자 정보를 불러오는 중 오류가 발생했습니다." }));
              return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ data, count, page, pageSize: PAGE_SIZE }));
          });

          // /api/admin/booths — GET / POST / PATCH / DELETE
          server.middlewares.use("/api/admin/booths", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (!checkAdmin(req, res, env)) return;

            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            const url = new URL(req.url, "http://localhost:5173");
            const id = url.searchParams.get("id");

            if (req.method === "GET") {
              const { data: boothsData, error: boothsError } = await supabase
                .from("booths")
                .select("*")
                .order("id", { ascending: true });

              if (boothsError) {
                console.error("[booths GET] error:", boothsError);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "부스 정보를 불러오는 중 오류가 발생했습니다." }));
                return;
              }

              const { data: stampData } = await supabase
                .from("stamp_records")
                .select("booth_id");

              const countMap = (stampData ?? []).reduce((acc, r) => {
                acc[r.booth_id] = (acc[r.booth_id] ?? 0) + 1;
                return acc;
              }, {});

              const booths = boothsData.map((b) => ({
                ...b,
                participant_count: countMap[b.booth_id] ?? 0,
              }));

              res.statusCode = 200;
              res.end(JSON.stringify({ data: booths }));
              return;
            }

            if (req.method === "POST") {
              const body = await readBody(req);
              const { booth_id, title, subtitle } = body;
              if (!booth_id || !title) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "booth_id와 title은 필수입니다." }));
                return;
              }
              const { data, error } = await supabase
                .from("booths")
                .insert({ booth_id, title, subtitle: subtitle ?? "" })
                .select()
                .single();
              if (error) {
                console.error("[booths POST] Supabase error:", JSON.stringify(error));
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message ?? "부스 추가 중 오류가 발생했습니다." }));
                return;
              }
              res.statusCode = 201;
              res.end(JSON.stringify({ data }));
              return;
            }

            if (req.method === "PATCH") {
              if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: "id는 필수입니다." })); return; }
              const { booth_id, title, subtitle } = await readBody(req);
              const updates = {};
              if (booth_id !== undefined) updates.booth_id = booth_id;
              if (title !== undefined) updates.title = title;
              if (subtitle !== undefined) updates.subtitle = subtitle;
              const { data, error } = await supabase.from("booths").update(updates).eq("id", id).select().single();
              if (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "부스 수정 중 오류가 발생했습니다." }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ data }));
              return;
            }

            if (req.method === "DELETE") {
              if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: "id는 필수입니다." })); return; }
              const { error } = await supabase.from("booths").delete().eq("id", id);
              if (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "부스 삭제 중 오류가 발생했습니다." }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Method not allowed" }));
          });
        },
      },
    ],
  };
});
