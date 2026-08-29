import { beforeEach, describe, expect, it, vi } from "vitest";

// checkpoint.js creates the Supabase client at module load time, so we mock
// @supabase/supabase-js and provide a fresh fake client per test via vi.resetModules().
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function createReq({ method = "POST", cookie, body } = {}) {
  return { method, headers: cookie ? { cookie } : {}, body };
}

function createRes() {
  const res = { statusCode: null, body: null };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

/**
 * checkpoint.js 안의 두 체이닝을 흉내낸 가짜 클라이언트:
 * - `.from("participants").select(...).eq("token", ...).maybeSingle()`
 * - `.from("participants").update(...).eq("id", ...)` (Promise 반환)
 */
function createSupabaseMock({ participantResult, updateResult }) {
  const maybeSingle = vi.fn(() => Promise.resolve(participantResult));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(updateResult)) })),
  }));
  return { from };
}

describe("POST /api/checkpoint", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("POST가 아니면 405를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({ participantResult: { data: null, error: null }, updateResult: { error: null } })
    );

    const handler = (await import("./checkpoint.js")).default;
    const req = createReq({ method: "GET" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("토큰 쿠키가 없으면, type이 잘못돼도 401(인증)이 먼저 응답된다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createSupabaseMock({ participantResult: { data: null, error: null }, updateResult: { error: null } });
    createClient.mockReturnValue(supabase);

    const handler = (await import("./checkpoint.js")).default;
    const req = createReq({ body: { type: "invalid-type" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "인증이 필요합니다." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("토큰은 있지만 type이 turn/finish가 아니면 400을 응답한다 (DB 조회 없이)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createSupabaseMock({ participantResult: { data: null, error: null }, updateResult: { error: null } });
    createClient.mockReturnValue(supabase);

    const handler = (await import("./checkpoint.js")).default;
    const req = createReq({ cookie: "wf_token=good-token", body: { type: "invalid-type" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("반환점 인증 없이 완주(finish) 인증을 시도하면 403을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1, is_turn_completed: false, is_finish_completed: false }, error: null },
        updateResult: { error: null },
      })
    );

    const handler = (await import("./checkpoint.js")).default;
    const req = createReq({ cookie: "wf_token=good-token", body: { type: "finish" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: "반환점 QR 코드를 먼저 찍은 후 이용해 주세요.", code: "TURN_REQUIRED" });
  });

  it("이미 완료된 인증을 다시 시도하면 409를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1, is_turn_completed: true, finish_photo_path: "p" }, error: null },
        updateResult: { error: null },
      })
    );

    const handler = (await import("./checkpoint.js")).default;
    const req = createReq({ cookie: "wf_token=good-token", body: { type: "turn" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("정상 요청이면 200으로 인증 성공을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1, is_turn_completed: false, finish_photo_path: null }, error: null },
        updateResult: { error: null },
      })
    );

    const handler = (await import("./checkpoint.js")).default;
    const req = createReq({ cookie: "wf_token=good-token", body: { type: "turn" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ success: true, type: "turn" });
  });
});
