import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// finishers.js creates the Supabase client at module load time, so we mock
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

/**
 * finishers.js 안의
 * `.from("participants").select(...).eq(...).order(...).range(...)[.or(...)]`
 * 체이닝을 흉내낸 가짜 쿼리 빌더. 각 메서드는 자기 자신을 반환하며(체이닝 가능),
 * await 시점에 result로 resolve된다(thenable).
 */
function createSupabaseMock(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    or: vi.fn(() => builder),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return {
    from: vi.fn(() => builder),
    _builder: builder,
  };
}

describe("GET /api/admin/finishers", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, ADMIN_PASSWORD: "secret-pw" };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns 401 when the admin password header is missing or wrong", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(createSupabaseMock({ data: [], error: null, count: 0 }));

    const handler = (await import("./finishers.js")).default;
    const req = { method: "GET", headers: {}, query: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("only queries is_finish_completed=true and hides finish_photo_path, exposing has_photo instead", async () => {
    const mock = createSupabaseMock({
      data: [
        { id: 1, name: "홍길동", phone: "010-1234-5678", finish_photo_path: "finish-photos/a.jpg" },
        { id: 2, name: "김철수", phone: "010-1111-2222", finish_photo_path: null },
      ],
      error: null,
      count: 2,
    });
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(mock);

    const handler = (await import("./finishers.js")).default;
    const req = { method: "GET", headers: { "x-admin-password": "secret-pw" }, query: {} };
    const res = createRes();

    await handler(req, res);

    expect(mock.from).toHaveBeenCalledWith("participants");
    expect(mock._builder.eq).toHaveBeenCalledWith("is_finish_completed", true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.data).toEqual([
      { id: 1, name: "홍길동", phone: "010-1234-5678", has_photo: true },
      { id: 2, name: "김철수", phone: "010-1111-2222", has_photo: false },
    ]);
    expect(res.body.count).toBe(2);
  });

  it("returns 500 when the query fails", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({ data: null, error: { message: "connection error" }, count: null })
    );

    const handler = (await import("./finishers.js")).default;
    const req = { method: "GET", headers: { "x-admin-password": "secret-pw" }, query: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: "완보자 정보를 불러오는 중 오류가 발생했습니다." });
  });

  it("returns 405 for non-GET methods", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(createSupabaseMock({ data: [], error: null, count: 0 }));

    const handler = (await import("./finishers.js")).default;
    const req = { method: "POST", headers: { "x-admin-password": "secret-pw" }, query: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });
});
