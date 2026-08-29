import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signBoothId } from "./_lib/qrSign.js";

// stamp.js creates the Supabase client at module load time, so we mock
// @supabase/supabase-js and provide a fresh fake client per test via vi.resetModules().
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const QR_SECRET = "test-qr-secret";

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
 * stamp.js 안의 두 체이닝을 흉내낸 가짜 클라이언트:
 * - `.from("participants").select(...).eq("token", ...).maybeSingle()`
 * - `.from("stamp_records").insert(...)` (Promise 반환)
 */
function createSupabaseMock({ participantResult, insertResult }) {
  const maybeSingle = vi.fn(() => Promise.resolve(participantResult));
  const from = vi.fn((table) => {
    if (table === "participants") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) };
    }
    if (table === "stamp_records") {
      return { insert: vi.fn(() => Promise.resolve(insertResult)) };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { from };
}

describe("POST /api/stamp", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, QR_SECRET };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("POST가 아니면 405를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({ participantResult: { data: null, error: null }, insertResult: { error: null } })
    );

    const handler = (await import("./stamp.js")).default;
    const req = createReq({ method: "GET" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("토큰 쿠키가 없으면, 서명이 유효하지 않아도 401(인증)이 먼저 응답된다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createSupabaseMock({ participantResult: { data: null, error: null }, insertResult: { error: null } });
    createClient.mockReturnValue(supabase);

    const handler = (await import("./stamp.js")).default;
    const req = createReq({ body: { boothId: "a", sig: "invalid" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "인증이 필요합니다." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("토큰은 있지만 QR 서명이 유효하지 않으면 404를 응답한다 (DB 조회 없이)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createSupabaseMock({ participantResult: { data: null, error: null }, insertResult: { error: null } });
    createClient.mockReturnValue(supabase);

    const handler = (await import("./stamp.js")).default;
    const req = createReq({ cookie: "wf_token=good-token", body: { boothId: "a", sig: "0".repeat(32) } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("유효하지 않은 세션이면 401을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({ participantResult: { data: null, error: null }, insertResult: { error: null } })
    );

    const handler = (await import("./stamp.js")).default;
    const sig = signBoothId("a", QR_SECRET);
    const req = createReq({ cookie: "wf_token=bad-token", body: { boothId: "a", sig } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "유효하지 않은 세션입니다." });
  });

  it("이미 도장을 받은 부스면(23505 unique violation) 409를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1 }, error: null },
        insertResult: { error: { code: "23505" } },
      })
    );

    const handler = (await import("./stamp.js")).default;
    const sig = signBoothId("a", QR_SECRET);
    const req = createReq({ cookie: "wf_token=good-token", body: { boothId: "a", sig } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("정상 요청이면 201로 도장 적립 성공을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1 }, error: null },
        insertResult: { error: null },
      })
    );

    const handler = (await import("./stamp.js")).default;
    const sig = signBoothId("a", QR_SECRET);
    const req = createReq({ cookie: "wf_token=good-token", body: { boothId: "a", sig } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toEqual({ success: true, boothId: "a" });
  });
});
