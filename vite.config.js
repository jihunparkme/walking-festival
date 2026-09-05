import { createClient } from "@supabase/supabase-js";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { validateStampRequest } from "./api/_lib/qrSign.js";
import { mapBoothsWithStats, toCountMap } from "./api/_lib/boothStats.js";
import { parseCookieToken, buildSetCookie, buildClearCookie } from "./api/_lib/auth.js";

/**
 * 요청 쿠키에 토큰이 존재하는지만 우선 검사한다 (로컬 개발용 Node 스타일 res).
 * 없으면 401 응답을 직접 보내고 null을 반환한다. 반환된 token은 이후
 * fetchParticipantByTokenLocal에 그대로 넘겨 재사용하면 되므로 쿠키를 두 번 파싱할 필요가 없다.
 */
function assertTokenPresentLocal(req, res) {
  const token = parseCookieToken(req.headers.cookie);
  if (!token) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "인증이 필요합니다." }));
    return null;
  }
  return token;
}

/**
 * 이미 확보한 token으로 participants를 조회해 세션을 검증한다 (로컬 개발용 Node 스타일 res).
 * 실패 시 401 응답을 직접 보내고 null을 반환하므로, 호출부는 null이면 즉시 return하면 된다.
 */
async function fetchParticipantByTokenLocal(supabase, token, selectFields, res) {
  const { data: participant, error } = await supabase
    .from("participants")
    .select(selectFields)
    .eq("token", token)
    .maybeSingle();

  if (error || !participant) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "유효하지 않은 세션입니다." }));
    return null;
  }

  return participant;
}

/**
 * 쿠키의 token으로 participants를 조회해 세션을 검증한다 (로컬 개발용 Node 스타일 res).
 * 실패 시 401 응답을 직접 보내고 null을 반환하므로, 호출부는 null이면 즉시 return하면 된다.
 * 토큰 존재 여부와 조회를 한 번에 처리하는 단순 라우트(GET 등)에서 사용하고,
 * 다른 검증(400 등)보다 토큰 누락 401을 먼저 응답해야 하는 라우트는
 * assertTokenPresentLocal + fetchParticipantByTokenLocal을 원하는 순서로 직접 조합한다.
 */
async function requireParticipantLocal(supabase, req, res, selectFields) {
  const token = assertTokenPresentLocal(req, res);
  if (!token) return null;
  return fetchParticipantByTokenLocal(supabase, token, selectFields, res);
}

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

/** 파일명에 쓸 수 없는 문자 제거 (이름/전화번호를 파일명 일부로 사용) */
// Supabase Storage 키는 한글 등 비 ASCII 문자를 허용하지 않으므로 ASCII 문자만 남긴다.
function sanitizeForFileName(value) {
  return String(value ?? "").replace(/[^\w-]/g, "");
}

function extFromContentType(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function isImageContentType(contentType) {
  return typeof contentType === "string" && contentType.startsWith("image/");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      // 로컬 개발 전용: 사용자 API 미들웨어
      {
        name: "local-user-api",
        configureServer(server) {
          // POST /api/auth — 등록/로그인, HttpOnly 쿠키 발급
          server.middlewares.use("/api/auth", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") {
              res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return;
            }
            const { name, phone, mode } = await readBody(req);
            if (!name?.trim() || !phone?.trim()) {
              res.statusCode = 400; res.end(JSON.stringify({ error: "이름과 전화번호는 필수입니다." })); return;
            }
            if (mode !== "register" && mode !== "login") {
              res.statusCode = 400; res.end(JSON.stringify({ error: "잘못된 요청입니다." })); return;
            }
            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            const trimmedName = name.trim(), trimmedPhone = phone.trim();

            // 이름 + 전화번호 조합으로 기존 참여자 여부 판단 (보호자가 같은 번호로 여러
            // 자녀를 등록하는 경우를 허용하기 위해 전화번호만으로는 판단하지 않는다)
            const { data: existing } = await supabase
              .from("participants").select("id, name, token").eq("phone", trimmedPhone).eq("name", trimmedName).maybeSingle();

            // 기존 참여자 로그인: 이름+전화번호 조합이 존재해야만 로그인 처리
            if (mode === "login") {
              if (!existing) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "등록된 참여자 정보를 찾을 수 없습니다. 신규 참여를 이용해 주세요." })); return;
              }
              // 로컬 개발: Secure 플래그 제외 (HTTP)
              res.setHeader("Set-Cookie", buildSetCookie(existing.token, { secure: false }));
              res.statusCode = 200;
              res.end(JSON.stringify({ isNew: false, lotteryNumber: String(existing.id).padStart(6, "0") }));
              return;
            }

            // 신규 참여 등록: 이름+전화번호 조합이 이미 존재하면 등록 거부
            if (existing) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "이미 동일한 이름과 전화번호로 등록되어 있습니다." })); return;
            }

            const { data: inserted, error: insertError } = await supabase
              .from("participants").insert({ name: trimmedName, phone: trimmedPhone }).select("id, token").single();
            if (insertError) {
              if (insertError.code === "23505") {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "이미 동일한 이름과 전화번호로 등록되어 있습니다." })); return;
              }
              res.statusCode = 500; res.end(JSON.stringify({ error: "참여자 등록 중 오류가 발생했습니다." })); return;
            }
            // 로컬 개발: Secure 플래그 제외 (HTTP)
            res.setHeader("Set-Cookie", buildSetCookie(inserted.token, { secure: false }));
            res.statusCode = 201;
            res.end(JSON.stringify({ isNew: true, lotteryNumber: String(inserted.id).padStart(6, "0") }));
          });

          // POST /api/logout — 쿠키 제거
          server.middlewares.use("/api/logout", (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") {
              res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return;
            }
            // 로컬 개발: Secure 플래그 제외 (HTTP)
            res.setHeader("Set-Cookie", buildClearCookie({ secure: false }));
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true }));
          });

          // GET /api/me — 쿠키 세션 확인
          server.middlewares.use("/api/me", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "GET") {
              res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return;
            }
            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            const participant = await requireParticipantLocal(
              supabase, req, res, "id, name, is_turn_completed, is_finish_completed, finish_photo_path"
            );
            if (!participant) return;

            res.statusCode = 200;
            res.end(JSON.stringify({
              name: participant.name,
              lotteryNumber: String(participant.id).padStart(6, "0"),
              isTurnCompleted: participant.is_turn_completed,
              isFinishCompleted: participant.is_finish_completed,
              hasFinishPhoto: Boolean(participant.finish_photo_path),
            }));
          });

          // GET /api/stamps — 쿠키 인증으로 도장 조회
          server.middlewares.use("/api/stamps", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "GET") {
              res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return;
            }
            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            const participant = await requireParticipantLocal(supabase, req, res, "id");
            if (!participant) return;

            const { data, error } = await supabase.from("stamp_records").select("booth_id").eq("participant_id", participant.id);
            if (error) { res.statusCode = 500; res.end(JSON.stringify({ error: "도장 정보를 불러오는 중 오류가 발생했습니다." })); return; }

            const stamps = (data ?? []).reduce((acc, r) => ({ ...acc, [r.booth_id]: true }), {});
            res.statusCode = 200;
            res.end(JSON.stringify({ stamps }));
          });

          // POST /api/stamp — 쿠키 인증으로 도장 적립
          server.middlewares.use("/api/stamp", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") {
              res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return;
            }
            // 기존 응답 순서(토큰 누락 401 > 서명 검증 오류) 유지를 위해 토큰 존재 여부만 먼저 확인
            const token = assertTokenPresentLocal(req, res);
            if (!token) return;

            const { boothId, sig } = await readBody(req);
            const validation = validateStampRequest(boothId, sig, env.QR_SECRET);
            if (!validation.ok) {
              res.statusCode = validation.status; res.end(JSON.stringify({ error: validation.error })); return;
            }

            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            const participant = await fetchParticipantByTokenLocal(supabase, token, "id", res);
            if (!participant) return;

            const { error: insertError } = await supabase
              .from("stamp_records").insert({ participant_id: participant.id, booth_id: boothId });
            if (insertError) {
              if (insertError.code === "23505") {
                res.statusCode = 409; res.end(JSON.stringify({ error: "이미 도장을 받은 부스입니다.", boothId })); return;
              }
              res.statusCode = 500; res.end(JSON.stringify({ error: "도장 저장 중 오류가 발생했습니다." })); return;
            }
            res.statusCode = 201;
            res.end(JSON.stringify({ success: true, boothId }));
          });

          // POST /api/checkpoint — 반환점/완주 QR 인증
          server.middlewares.use("/api/checkpoint", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") {
              res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return;
            }
            // 기존 응답 순서(토큰 누락 401 > type 오류 400) 유지를 위해 토큰 존재 여부만 먼저 확인
            const token = assertTokenPresentLocal(req, res);
            if (!token) return;

            const { type } = await readBody(req);
            const FIELD_BY_TYPE = { turn: "is_turn_completed", finish: "is_finish_completed" };
            const field = FIELD_BY_TYPE[type];
            if (!field) { res.statusCode = 400; res.end(JSON.stringify({ error: "type은 turn 또는 finish여야 합니다." })); return; }

            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            const participant = await fetchParticipantByTokenLocal(
              supabase, token, `id, is_turn_completed, finish_photo_path, ${field}`, res
            );
            if (!participant) return;

            // 완주 인증은 반환점 인증이 먼저 완료되어야 진행 가능
            if (type === "finish" && !participant.is_turn_completed) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "반환점 QR 코드를 먼저 찍은 후 이용해 주세요.", code: "TURN_REQUIRED" }));
              return;
            }

            if (participant[field]) {
              // 완주 인증은 이미 완료됐지만 사진을 아직 등록하지 못한 경우 재등록을 허용
              if (type === "finish" && !participant.finish_photo_path) {
                res.statusCode = 409;
                res.end(JSON.stringify({ error: "완주 인증은 완료되었지만 사진이 등록되지 않았습니다.", type, needsPhoto: true }));
                return;
              }
              res.statusCode = 409; res.end(JSON.stringify({ error: "이미 인증이 완료되었습니다.", type })); return;
            }

            // 조회 이후 동시 중복 요청이 함께 통과하는 것을 막기 위해
            // field가 아직 false인 행에 한해서만 UPDATE가 적용되도록 조건을 건다(원자적 체크 앤 셋).
            const { data: updated, error: updateError } = await supabase
              .from("participants")
              .update({ [field]: true })
              .eq("id", participant.id)
              .eq(field, false)
              .select("id")
              .maybeSingle();
            if (updateError) {
              res.statusCode = 500; res.end(JSON.stringify({ error: "인증 저장 중 오류가 발생했습니다." })); return;
            }
            // 앞선 조회 이후 동시 요청이 먼저 UPDATE를 적용해 이미 field가 true가 된 경우
            if (!updated) {
              res.statusCode = 409; res.end(JSON.stringify({ error: "이미 인증이 완료되었습니다.", type })); return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, type }));
          });

          // GET/POST /api/finish-photo — 완주 인증샷 조회(서명된 URL)/업로드 (walking-festival private 버킷)
          const FINISH_PHOTO_SIGNED_URL_EXPIRES_IN = 60 * 10;
          server.middlewares.use("/api/finish-photo", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

            if (req.method === "GET") {
              const participant = await requireParticipantLocal(supabase, req, res, "id, finish_photo_path");
              if (!participant) return;
              if (!participant.finish_photo_path) { res.statusCode = 404; res.end(JSON.stringify({ error: "등록된 완주 사진이 없습니다." })); return; }

              const { data: signed, error: signError } = await supabase.storage
                .from("walking-festival")
                .createSignedUrl(participant.finish_photo_path, FINISH_PHOTO_SIGNED_URL_EXPIRES_IN);
              if (signError || !signed) { res.statusCode = 500; res.end(JSON.stringify({ error: "사진을 불러오는 중 오류가 발생했습니다." })); return; }

              res.statusCode = 200;
              res.end(JSON.stringify({ url: signed.signedUrl }));
              return;
            }

            if (req.method !== "POST") {
              res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return;
            }

            // 기존 응답 순서(토큰 누락 401 > 사진 데이터 검증 400) 유지를 위해 토큰 존재 여부만 먼저 확인
            const token = assertTokenPresentLocal(req, res);
            if (!token) return;

            const { fileBase64, contentType } = await readBody(req);
            if (!fileBase64) { res.statusCode = 400; res.end(JSON.stringify({ error: "사진 데이터가 필요합니다." })); return; }
            if (!isImageContentType(contentType)) {
              res.statusCode = 400; res.end(JSON.stringify({ error: "이미지 파일만 업로드할 수 있습니다." })); return;
            }

            const participant = await fetchParticipantByTokenLocal(
              supabase, token, "id, name, phone, is_finish_completed", res
            );
            if (!participant) return;
            if (!participant.is_finish_completed) {
              res.statusCode = 400; res.end(JSON.stringify({ error: "완주 인증을 먼저 완료해 주세요." })); return;
            }

            const buffer = Buffer.from(fileBase64.split(",").pop(), "base64");
            const ext = extFromContentType(contentType);
            const fileName = `${sanitizeForFileName(participant.name)}_${sanitizeForFileName(participant.phone)}_${participant.id}.${ext}`;
            const path = `finish-photos/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from("walking-festival")
              .upload(path, buffer, { contentType: contentType || "image/jpeg", upsert: true });
            if (uploadError) {
              res.statusCode = 500; res.end(JSON.stringify({ error: "사진 업로드 중 오류가 발생했습니다." })); return;
            }

            const { error: updateError } = await supabase
              .from("participants").update({ finish_photo_path: path }).eq("id", participant.id);
            if (updateError) {
              res.statusCode = 500; res.end(JSON.stringify({ error: "사진 정보 저장 중 오류가 발생했습니다." })); return;
            }

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, path }));
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

              // booth_id별 도장 수 집계 — DB의 GROUP BY 집계 함수로 booth당 1행만 받아온다
              // (stamp_records 전체 로우를 가져와 JS에서 집계하지 않음)
              const { data: countRows, error: countError } = await supabase.rpc("get_booth_stamp_counts");

              // RPC 실패(예: DB에 get_booth_stamp_counts 함수 미생성)를 조용히 넘기면 모든 부스의
              // 참여 인원이 0으로 잘못 표시되므로, 실패 시에는 명확히 에러를 반환한다.
              if (countError) {
                console.error("[booths GET] stamp counts error:", countError);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "도장 집계 정보를 불러오는 중 오류가 발생했습니다." }));
                return;
              }

              const booths = mapBoothsWithStats(boothsData, toCountMap(countRows), env.QR_SECRET);

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
