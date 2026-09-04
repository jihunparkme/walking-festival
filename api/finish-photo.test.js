import { beforeEach, describe, expect, it, vi } from "vitest";

// finish-photo.js creates the Supabase client at module load time, so we mock
// @supabase/supabase-js and provide a fresh fake client per test via vi.resetModules().
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function createReq({ method = "GET", cookie, body } = {}) {
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
 * finish-photo.js 안의 체이닝을 흉내낸 가짜 클라이언트:
 * - `.from("participants").select(...).eq("token", ...).maybeSingle()`
 * - `.from("participants").update(...).eq("id", ...)` (Promise 반환)
 * - `.storage.from(BUCKET).createSignedUrl(...)` / `.upload(...)`
 */
function createSupabaseMock({ participantResult, updateResult, signedUrlResult, uploadResult }) {
  const maybeSingle = vi.fn(() => Promise.resolve(participantResult));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(updateResult)) })),
  }));
  const storage = {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn(() => Promise.resolve(signedUrlResult)),
      upload: vi.fn(() => Promise.resolve(uploadResult)),
    })),
  };
  return { from, storage };
}

describe("GET /api/finish-photo", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("토큰 쿠키가 없으면 401을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: null, error: null },
        updateResult: { error: null },
        signedUrlResult: { data: null, error: null },
        uploadResult: { error: null },
      })
    );

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({ method: "GET" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "인증이 필요합니다." });
  });

  it("등록된 완주 사진이 없으면 404를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1, finish_photo_path: null }, error: null },
        updateResult: { error: null },
        signedUrlResult: { data: null, error: null },
        uploadResult: { error: null },
      })
    );

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({ method: "GET", cookie: "wf_token=good-token" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("등록된 사진이 있으면 서명된 URL을 200으로 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1, finish_photo_path: "finish-photos/a.jpg" }, error: null },
        updateResult: { error: null },
        signedUrlResult: { data: { signedUrl: "https://example.com/signed" }, error: null },
        uploadResult: { error: null },
      })
    );

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({ method: "GET", cookie: "wf_token=good-token" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ url: "https://example.com/signed" });
  });
});

describe("POST /api/finish-photo", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("POST/GET이 아니면 405를 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: null, error: null },
        updateResult: { error: null },
        signedUrlResult: { data: null, error: null },
        uploadResult: { error: null },
      })
    );

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({ method: "DELETE" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("토큰 쿠키가 없으면, 사진 데이터가 없어도 401(인증)이 먼저 응답된다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createSupabaseMock({
      participantResult: { data: null, error: null },
      updateResult: { error: null },
      signedUrlResult: { data: null, error: null },
      uploadResult: { error: null },
    });
    createClient.mockReturnValue(supabase);

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({ method: "POST", body: {} });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "인증이 필요합니다." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("사진 데이터가 없으면 400을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: null, error: null },
        updateResult: { error: null },
        signedUrlResult: { data: null, error: null },
        uploadResult: { error: null },
      })
    );

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({ method: "POST", cookie: "wf_token=good-token", body: {} });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: "사진 데이터가 필요합니다." });
  });

  it("이미지 파일이 아니면 400을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: null, error: null },
        updateResult: { error: null },
        signedUrlResult: { data: null, error: null },
        uploadResult: { error: null },
      })
    );

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({
      method: "POST",
      cookie: "wf_token=good-token",
      body: { fileBase64: "data:text/plain;base64,aGVsbG8=", contentType: "text/plain" },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: "이미지 파일만 업로드할 수 있습니다." });
  });

  it("완주 인증이 완료되지 않았으면 400을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1, name: "홍길동", phone: "010-1234-5678", is_finish_completed: false }, error: null },
        updateResult: { error: null },
        signedUrlResult: { data: null, error: null },
        uploadResult: { error: null },
      })
    );

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({
      method: "POST",
      cookie: "wf_token=good-token",
      body: { fileBase64: "data:image/jpeg;base64,aGVsbG8=", contentType: "image/jpeg" },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: "완주 인증을 먼저 완료해 주세요." });
  });

  it("정상 업로드 요청이면 200으로 성공을 응답한다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    createClient.mockReturnValue(
      createSupabaseMock({
        participantResult: { data: { id: 1, name: "홍길동", phone: "010-1234-5678", is_finish_completed: true }, error: null },
        updateResult: { error: null },
        signedUrlResult: { data: null, error: null },
        uploadResult: { error: null },
      })
    );

    const handler = (await import("./finish-photo.js")).default;
    const req = createReq({
      method: "POST",
      cookie: "wf_token=good-token",
      body: { fileBase64: "data:image/jpeg;base64,aGVsbG8=", contentType: "image/jpeg" },
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ success: true, path: expect.stringContaining("finish-photos/") });
  });
});
