// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StampScanPage from "./StampScanPage";

// StampScanPage는 완주 사진 저장 시 uploadFinishPhoto(useFinishPhotoCapture 훅 내부)를 호출한다.
// 이 테스트 스위트에서는 실제 업로드 API를 호출하지 않도록 lib/finishPhoto를 모킹한다.
vi.mock("../lib/finishPhoto", () => ({
  uploadFinishPhoto: vi.fn(),
}));

describe("StampScanPage — 완주 인증 후 사진 촬영 단계", () => {
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = ORIGINAL_FETCH;
  });

  it("완주 인증이 성공하면 '완주 사진 인증하기'와 '사진 촬영 없이 인증하기' 버튼을 모두 노출한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const onDone = vi.fn();

    render(
      <StampScanPage
        mode="checkpoint"
        checkpointType="finish"
        authStatus="ok"
        onDone={onDone}
      />
    );

    expect(await screen.findByText("완주 사진 인증하기")).toBeInTheDocument();
    expect(screen.getByText("사진 촬영 없이 인증하기")).toBeInTheDocument();
  });

  it("'사진 촬영 없이 인증하기' 클릭 시 사진 업로드 없이 skipPhoto: true로 onDone을 호출한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    const user = userEvent.setup();

    render(
      <StampScanPage
        mode="checkpoint"
        checkpointType="finish"
        authStatus="ok"
        onDone={onDone}
      />
    );

    const skipButton = await screen.findByText("사진 촬영 없이 인증하기");
    await user.click(skipButton);

    const { uploadFinishPhoto } = await import("../lib/finishPhoto");
    expect(uploadFinishPhoto).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({
      status: "success",
      mode: "checkpoint",
      checkpointType: "finish",
      skipPhoto: true,
    });
  });

  it("완주 인증이 이미 완료됐지만(needsPhoto) 사진 미등록이면 재진입 시에도 스킵 버튼이 보인다", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ needsPhoto: true }),
    });
    const onDone = vi.fn();

    render(
      <StampScanPage
        mode="checkpoint"
        checkpointType="finish"
        authStatus="ok"
        onDone={onDone}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("사진 촬영 없이 인증하기")).toBeInTheDocument();
    });
  });
});
