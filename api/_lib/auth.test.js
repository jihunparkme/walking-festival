import { describe, expect, it, vi } from "vitest";
import {
  COOKIE_NAME,
  assertTokenPresent,
  buildClearCookie,
  buildSetCookie,
  fetchParticipantByToken,
  parseCookieToken,
  requireParticipant,
} from "./auth.js";

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

/** requireParticipant 안의 `.from("participants").select(...).eq(...).maybeSingle()` 체이닝을 흉내낸 가짜 클라이언트 */
function createSupabaseMock(maybeSingleResult) {
  const maybeSingle = vi.fn(() => Promise.resolve(maybeSingleResult));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, eq, maybeSingle };
}

describe("parseCookieToken", () => {
  it("Cookie 헤더에서 wf_token 값을 추출한다", () => {
    expect(parseCookieToken(`${COOKIE_NAME}=abc123`)).toBe("abc123");
  });

  it("다른 쿠키와 섞여 있어도 wf_token만 정확히 추출한다", () => {
    expect(parseCookieToken(`foo=bar; ${COOKIE_NAME}=abc123; baz=qux`)).toBe("abc123");
  });

  it("Cookie 헤더가 없으면 null을 반환한다", () => {
    expect(parseCookieToken(undefined)).toBeNull();
    expect(parseCookieToken(null)).toBeNull();
    expect(parseCookieToken("")).toBeNull();
  });

  it("wf_token이 없으면 null을 반환한다", () => {
    expect(parseCookieToken("foo=bar; baz=qux")).toBeNull();
  });
});

describe("buildSetCookie", () => {
  it("기본값(secure=true)일 때 Secure 플래그를 포함한다", () => {
    const cookie = buildSetCookie("my-token");
    expect(cookie).toContain(`${COOKIE_NAME}=my-token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${180 * 24 * 60 * 60}`);
  });

  it("secure=false일 때 Secure 플래그를 제외한다 (로컬 개발용)", () => {
    const cookie = buildSetCookie("my-token", { secure: false });
    expect(cookie).not.toContain("Secure");
    expect(cookie).toContain(`${COOKIE_NAME}=my-token`);
  });
});

describe("buildClearCookie", () => {
  it("기본값(secure=true)일 때 Max-Age=0과 Secure 플래그를 포함한다", () => {
    const cookie = buildClearCookie();
    expect(cookie).toContain(`${COOKIE_NAME}=;`);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=0");
  });

  it("secure=false일 때 Secure 플래그를 제외한다 (로컬 개발용)", () => {
    const cookie = buildClearCookie({ secure: false });
    expect(cookie).not.toContain("Secure");
    expect(cookie).toContain("Max-Age=0");
  });
});

describe("assertTokenPresent", () => {
  it("토큰이 있으면 token 값을 반환하고 응답을 보내지 않는다", () => {
    const req = { headers: { cookie: `${COOKIE_NAME}=abc123` } };
    const res = createRes();

    const token = assertTokenPresent(req, res);

    expect(token).toBe("abc123");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("토큰이 없으면 401을 응답하고 null을 반환한다", () => {
    const req = { headers: {} };
    const res = createRes();

    const token = assertTokenPresent(req, res);

    expect(token).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "인증이 필요합니다." });
  });
});

describe("fetchParticipantByToken", () => {
  it("조회 결과 에러가 있으면 401을 응답하고 null을 반환한다", async () => {
    const req = { headers: {} };
    const res = createRes();
    const supabase = createSupabaseMock({ data: null, error: { message: "db error" } });

    const result = await fetchParticipantByToken(req, res, "abc123", supabase, "id");

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "유효하지 않은 세션입니다." });
  });

  it("참여자가 존재하지 않으면 401을 응답하고 null을 반환한다", async () => {
    const req = { headers: {} };
    const res = createRes();
    const supabase = createSupabaseMock({ data: null, error: null });

    const result = await fetchParticipantByToken(req, res, "abc123", supabase, "id");

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "유효하지 않은 세션입니다." });
  });

  it("전달받은 token을 그대로 사용해 조회하며(재파싱 없음), 성공 시 participant를 반환하고 req.__participantId를 표시한다", async () => {
    const req = { headers: {} };
    const res = createRes();
    const participant = { id: 42, name: "홍길동" };
    const supabase = createSupabaseMock({ data: participant, error: null });

    const result = await fetchParticipantByToken(req, res, "abc123", supabase, "id, name");

    expect(result).toEqual(participant);
    expect(res.status).not.toHaveBeenCalled();
    expect(supabase.select).toHaveBeenCalledWith("id, name");
    expect(supabase.eq).toHaveBeenCalledWith("token", "abc123");
    expect(req.__participantId).toBe("42");
  });
});

describe("requireParticipant", () => {
  it("토큰이 없으면 401을 응답하고 null을 반환한다", async () => {
    const req = { headers: {} };
    const res = createRes();
    const supabase = createSupabaseMock({ data: null, error: null });

    const result = await requireParticipant(req, res, supabase, "id");

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "인증이 필요합니다." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("조회 결과 에러가 있으면 401을 응답하고 null을 반환한다", async () => {
    const req = { headers: { cookie: `${COOKIE_NAME}=abc123` } };
    const res = createRes();
    const supabase = createSupabaseMock({ data: null, error: { message: "db error" } });

    const result = await requireParticipant(req, res, supabase, "id");

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "유효하지 않은 세션입니다." });
  });

  it("참여자가 존재하지 않으면 401을 응답하고 null을 반환한다", async () => {
    const req = { headers: { cookie: `${COOKIE_NAME}=abc123` } };
    const res = createRes();
    const supabase = createSupabaseMock({ data: null, error: null });

    const result = await requireParticipant(req, res, supabase, "id");

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "유효하지 않은 세션입니다." });
  });

  it("유효한 토큰이면 participant를 반환하고 req.__participantId를 표시한다", async () => {
    const req = { headers: { cookie: `${COOKIE_NAME}=abc123` } };
    const res = createRes();
    const participant = { id: 42, name: "홍길동" };
    const supabase = createSupabaseMock({ data: participant, error: null });

    const result = await requireParticipant(req, res, supabase, "id, name");

    expect(result).toEqual(participant);
    expect(res.status).not.toHaveBeenCalled();
    expect(supabase.select).toHaveBeenCalledWith("id, name");
    expect(supabase.eq).toHaveBeenCalledWith("token", "abc123");
    expect(req.__participantId).toBe("42");
  });
});
