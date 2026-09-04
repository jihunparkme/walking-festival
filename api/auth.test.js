import { beforeEach, describe, expect, it, vi } from "vitest";

// auth.js creates the Supabase client at module load time, so we mock
// @supabase/supabase-js and provide a fresh fake client per test via vi.resetModules().
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function createReq({ method = "POST", body } = {}) {
  return { method, body };
}

function createRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });
  res.setHeader = vi.fn((key, value) => {
    res.headers[key] = value;
  });
  return res;
}

/**
 * auth.js 안의 두 체이닝을 흉내낸 가짜 클라이언트:
 * - `.from("participants").select(...).eq("phone", ...).eq("name", ...).maybeSingle()`
 * - `.from("participants").insert(...).select(...).single()`
 */
function createSupabaseMock({ selectResult, insertResult }) {
  const maybeSingle = vi.fn(() => Promise.resolve(selectResult));
  const single = vi.fn(() => Promise.resolve(insertResult));
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
  }));
  const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
  const from = vi.fn(() => ({ select, insert }));
  return { from, select, insert, maybeSingle, single };
}

describe("POST /api/auth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("POST가 아니면 405를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(createSupabaseMock({ selectResult: { data: null, error: null } }));

    const handler = (await import("./auth.js")).default;
    const req = createReq({ method: "GET" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("이름 또는 전화번호가 없으면 400을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(createSupabaseMock({ selectResult: { data: null, error: null } }));

    const handler = (await import("./auth.js")).default;
    const req = createReq({ body: { name: "", phone: "010-1234-5678", mode: "register" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: "이름과 전화번호는 필수입니다." });
  });

  it("mode가 register/login이 아니면 400을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createSupabaseMock({ selectResult: { data: null, error: null } });
    createClient.mockReturnValue(supabase);

    const handler = (await import("./auth.js")).default;
    const req = createReq({ body: { name: "홍길동", phone: "010-1234-5678", mode: "unknown" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: "잘못된 요청입니다." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  describe("mode: register (신규 참여)", () => {
    it("이름+전화번호 조합이 없으면 신규 등록 후 201과 쿠키를 응답한다", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createSupabaseMock({
        selectResult: { data: null, error: null },
        insertResult: { data: { id: 7, token: "tok-7" }, error: null },
      });
      createClient.mockReturnValue(supabase);

      const handler = (await import("./auth.js")).default;
      const req = createReq({ body: { name: "홍길동", phone: "010-1234-5678", mode: "register" } });
      const res = createRes();

      await handler(req, res);

      expect(supabase.insert).toHaveBeenCalledWith({ name: "홍길동", phone: "010-1234-5678" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.body).toEqual({ isNew: true, lotteryNumber: "000007" });
      expect(res.headers["Set-Cookie"]).toContain("wf_token=tok-7");
    });

    it("이름+전화번호 조합이 이미 있으면 400을 응답하고 신규 등록을 시도하지 않는다", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createSupabaseMock({
        selectResult: { data: { id: 1, name: "홍길동", token: "tok-1" }, error: null },
      });
      createClient.mockReturnValue(supabase);

      const handler = (await import("./auth.js")).default;
      const req = createReq({ body: { name: "홍길동", phone: "010-1234-5678", mode: "register" } });
      const res = createRes();

      await handler(req, res);

      expect(supabase.insert).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({ error: "이미 동일한 이름과 전화번호로 등록되어 있습니다." });
      expect(res.headers["Set-Cookie"]).toBeUndefined();
    });

    it("동시 요청 등으로 INSERT가 UNIQUE 제약(23505)에 걸리면 400을 응답한다", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createSupabaseMock({
        selectResult: { data: null, error: null },
        insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
      });
      createClient.mockReturnValue(supabase);

      const handler = (await import("./auth.js")).default;
      const req = createReq({ body: { name: "홍길동", phone: "010-1234-5678", mode: "register" } });
      const res = createRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({ error: "이미 동일한 이름과 전화번호로 등록되어 있습니다." });
    });

    it("INSERT가 그 외 오류로 실패하면 500을 응답한다", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createSupabaseMock({
        selectResult: { data: null, error: null },
        insertResult: { data: null, error: { code: "500", message: "db error" } },
      });
      createClient.mockReturnValue(supabase);

      const handler = (await import("./auth.js")).default;
      const req = createReq({ body: { name: "홍길동", phone: "010-1234-5678", mode: "register" } });
      const res = createRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body).toEqual({ error: "참여자 등록 중 오류가 발생했습니다." });
    });
  });

  describe("mode: login (기존 참여자 재로그인)", () => {
    it("이름+전화번호 조합이 있으면 200과 쿠키를 응답한다", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createSupabaseMock({
        selectResult: { data: { id: 3, name: "홍길동", token: "tok-3" }, error: null },
      });
      createClient.mockReturnValue(supabase);

      const handler = (await import("./auth.js")).default;
      const req = createReq({ body: { name: "홍길동", phone: "010-1234-5678", mode: "login" } });
      const res = createRes();

      await handler(req, res);

      expect(supabase.insert).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body).toEqual({ isNew: false, lotteryNumber: "000003" });
      expect(res.headers["Set-Cookie"]).toContain("wf_token=tok-3");
    });

    it("이름+전화번호 조합이 없으면 404를 응답하고 등록을 시도하지 않는다", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createSupabaseMock({ selectResult: { data: null, error: null } });
      createClient.mockReturnValue(supabase);

      const handler = (await import("./auth.js")).default;
      const req = createReq({ body: { name: "홍길동", phone: "010-1234-5678", mode: "login" } });
      const res = createRes();

      await handler(req, res);

      expect(supabase.insert).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body).toEqual({ error: "등록된 참여자 정보를 찾을 수 없습니다. 신규 참여를 이용해 주세요." });
    });
  });

  it("기존 참여자 조회가 실패하면 500을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createSupabaseMock({ selectResult: { data: null, error: { message: "db error" } } });
    createClient.mockReturnValue(supabase);

    const handler = (await import("./auth.js")).default;
    const req = createReq({ body: { name: "홍길동", phone: "010-1234-5678", mode: "register" } });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: "서버 조회 중 오류가 발생했습니다." });
  });
});
