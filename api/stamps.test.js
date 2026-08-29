import { beforeEach, describe, expect, it, vi } from "vitest";

// stamps.js creates the Supabase client at module load time, so we mock
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

/**
 * stamps.js 안의 두 체이닝을 흉내낸 가짜 클라이언트:
 * - `.from("participants").select(...).eq("token", ...).maybeSingle()`
 * - `.from("stamp_records").select(...).eq("participant_id", ...)` (Promise 반환)
 */
function createSupabaseMock({ participantResult, stampRecordsResult }) {
  const maybeSingle = vi.fn(() => Promise.resolve(participantResult));
  const from = vi.fn((table) => {
    if (table === "participants") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) };
    }
    if (table === "stamp_records") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(stampRecordsResult)) })) };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { from };
}

describe("GET /api/stamps", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("GET이 아니면 405를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({ participantResult: { data: null, error: null }, stampRecordsResult: { data: [], error: null } })
    );

    const handler = (await import("./stamps.js")).default;
    const req = createReq({ method: "POST" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("토큰 쿠키가 없으면 401을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({ participantResult: { data: null, error: null }, stampRecordsResult: { data: [], error: null } })
    );

    const handler = (await import("./stamps.js")).default;
    const req = createReq();
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "인증이 필요합니다." });
  });

  it("stamp_records 조회가 실패하면 500을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1 }, error: null },
        stampRecordsResult: { data: null, error: { message: "db error" } },
      })
    );

    const handler = (await import("./stamps.js")).default;
    const req = createReq({ cookie: "wf_token=good-token" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("정상 조회 시 부스별 도장 여부를 map으로 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1 }, error: null },
        stampRecordsResult: { data: [{ booth_id: "a" }, { booth_id: "b" }], error: null },
      })
    );

    const handler = (await import("./stamps.js")).default;
    const req = createReq({ cookie: "wf_token=good-token" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ stamps: { a: true, b: true } });
  });
});
