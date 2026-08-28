import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// admin/booths.js creates the Supabase client at module load time, so we mock
// @supabase/supabase-js and provide a fresh fake client per test via vi.resetModules().
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

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

/** booths.js 안의 `.from("booths").select("*").order(...)` 체이닝을 흉내낸 가짜 클라이언트 */
function createSupabaseMock({ boothsResult, rpcResult }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve(boothsResult)),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve(rpcResult)),
  };
}

describe("GET /api/admin/booths — get_booth_stamp_counts RPC 실패 처리", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, ADMIN_PASSWORD: "secret-pw", QR_SECRET: "qr-secret" };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns 500 (not a silent fallback to 0) when the RPC call fails", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        boothsResult: { data: [{ id: 1, booth_id: "a", title: "부스 A" }], error: null },
        rpcResult: { data: null, error: { message: "function get_booth_stamp_counts() does not exist" } },
      })
    );

    const handler = (await import("./booths.js")).default;
    const req = { method: "GET", headers: { "x-admin-password": "secret-pw" } };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: "도장 집계 정보를 불러오는 중 오류가 발생했습니다." });
  });

  it("returns 200 with mapped participant_count when the RPC succeeds", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        boothsResult: { data: [{ id: 1, booth_id: "a", title: "부스 A" }], error: null },
        rpcResult: { data: [{ booth_id: "a", participant_count: 7 }], error: null },
      })
    );

    const handler = (await import("./booths.js")).default;
    const req = { method: "GET", headers: { "x-admin-password": "secret-pw" } };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.data[0]).toMatchObject({ booth_id: "a", participant_count: 7 });
  });

  it("returns 500 when the booths list itself fails to load (unrelated to the RPC)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        boothsResult: { data: null, error: { message: "connection error" } },
        rpcResult: { data: [], error: null },
      })
    );

    const handler = (await import("./booths.js")).default;
    const req = { method: "GET", headers: { "x-admin-password": "secret-pw" } };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: "부스 정보를 불러오는 중 오류가 발생했습니다." });
  });

  it("returns 401 when the admin password header is missing or wrong", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(createSupabaseMock({ boothsResult: { data: [], error: null }, rpcResult: { data: [], error: null } }));

    const handler = (await import("./booths.js")).default;
    const req = { method: "GET", headers: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
