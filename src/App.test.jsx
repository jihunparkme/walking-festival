// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// App.jsx는 모듈 로드 시점에 window.location(search/pathname)을 읽어 URL_TYPE 등의
// 상수를 계산하므로, 테스트마다 원하는 URL을 먼저 세팅한 뒤 모듈을 새로 import해야 한다.
vi.mock("./lib/auth", () => ({
  fetchMe: vi.fn(),
  registerOrLogin: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("./lib/booths", () => ({
  fetchBooths: vi.fn().mockResolvedValue([]),
}));
vi.mock("./lib/stamps", () => ({
  fetchMyStamps: vi.fn().mockResolvedValue({}),
}));
vi.mock("./lib/finishPhoto", () => ({
  fetchFinishPhotoUrl: vi.fn().mockResolvedValue(null),
  uploadFinishPhoto: vi.fn(),
}));

async function renderAppAt(pathname, { isFinishCompleted = false, hasFinishPhoto = false } = {}) {
  window.history.pushState({}, "", pathname);
  vi.resetModules();

  const { fetchMe } = await import("./lib/auth");
  fetchMe.mockResolvedValue({
    name: "홍길동",
    lotteryNumber: "000001",
    isTurnCompleted: true,
    isFinishCompleted,
    hasFinishPhoto,
  });

  const { default: App } = await import("./App.jsx");
  return render(<App />);
}

describe("App — 완주 사진 메뉴 노출 조건 및 사진 없이 완주 인증 플로우", () => {
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = ORIGINAL_FETCH;
    window.history.pushState({}, "", "/");
  });

  it("완주 인증만 완료되고 사진은 미등록이어도(hasFinishPhoto=false) 하단 '완주 사진' 탭이 노출된다", async () => {
    await renderAppAt("/", { isFinishCompleted: true, hasFinishPhoto: false });

    expect(await screen.findByText("완주 사진")).toBeInTheDocument();
  });

  it("완주 인증을 하지 않았다면 '완주 사진' 탭이 노출되지 않는다", async () => {
    await renderAppAt("/", { isFinishCompleted: false, hasFinishPhoto: false });

    // 로그인 확인(fetchMe) 완료를 기다린 뒤에도 탭이 없어야 한다
    await waitFor(() => expect(screen.getByText("도장판")).toBeInTheDocument());
    expect(screen.queryByText("완주 사진")).not.toBeInTheDocument();
  });

  it("'/stamp?type=finish' 진입 후 '사진 촬영 없이 인증하기'를 클릭하면 완주 사진 메뉴로 바로 이동한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    await renderAppAt("/stamp?type=finish", { isFinishCompleted: false, hasFinishPhoto: false });

    const skipButton = await screen.findByText("사진 촬영 없이 인증하기");
    await user.click(skipButton);

    // 완주 사진 메뉴(FinishPhotoSection)로 전환되어 사진 미등록 안내 문구가 보여야 한다
    expect(await screen.findByText("완주 인증 사진")).toBeInTheDocument();
    expect(await screen.findByText("아직 등록된 완주 인증 사진이 없습니다.")).toBeInTheDocument();
  });
});
