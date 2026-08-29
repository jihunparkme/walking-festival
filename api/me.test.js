import { beforeEach, describe, expect, it, vi } from "vitest";

// me.js creates the Supabase client at module load time, so we mock
// @supabase/supabase-js and provide a fresh fake client per test via vi.resetModules().
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function createReq({ method = "GET", cookie } = {}) {
  return { method, headers: cookie ? { cookie } : {} };
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

/** me.js 안의 `.from("participants").select(...).eq("token", ...).maybeSingle()` 체이닝을 흉내낸 가짜 클라이언트 */
function createSupabaseMock(participantResult) {
  const maybeSingle = vi.fn(() => Promise.resolve(participantResult));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, eq, maybeSingle };
}

describe("GET /api/me", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("GET이 아니면 405를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(createSupabaseMock({ data: null, error: null }));

    const handler = (await import("./me.js")).default;
    const req = createReq({ method: "POST" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("토큰 쿠키가 없으면 401을 응답한다 (DB 조회 없이)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createSupabaseMock({ data: null, error: null });
    createClient.mockReturnValue(supabase);

    const handler = (await import("./me.js")).default;
    const req = createReq();
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "인증이 필요합니다." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("유효하지 않은 토큰이면 401을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(createSupabaseMock({ data: null, error: null }));

    const handler = (await import("./me.js")).default;
    const req = createReq({ cookie: "wf_token=bad-token" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "유효하지 않은 세션입니다." });
  });

  it("유효한 토큰이면 참여자 정보를 200으로 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        data: {
          id: 42,
          name: "홍길동",
          is_turn_completed: true,
          is_finish_completed: false,
          finish_photo_path: null,
        },
        error: null,
      })
    );

    const handler = (await import("./me.js")).default;
    const req = createReq({ cookie: "wf_token=good-token" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      name: "홍길동",
      lotteryNumber: "000042",
      isTurnCompleted: true,
      isFinishCompleted: false,
      hasFinishPhoto: false,
    });
  });
});
