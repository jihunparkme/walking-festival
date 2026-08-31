// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinishPhotoSection from "./FinishPhotoSection";

vi.mock("../lib/finishPhoto", () => ({
  fetchFinishPhotoUrl: vi.fn(),
  uploadFinishPhoto: vi.fn(),
}));

describe("FinishPhotoSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("등록된 사진이 있으면(url 반환) 사진을 렌더링한다", async () => {
    const { fetchFinishPhotoUrl } = await import("../lib/finishPhoto");
    fetchFinishPhotoUrl.mockResolvedValue("https://example.com/signed.jpg");

    render(<FinishPhotoSection />);

    const img = await screen.findByAltText("완주 인증 사진");
    expect(img).toHaveAttribute("src", "https://example.com/signed.jpg");
  });

  it("사진이 없으면(url: null) 오류 대신 촬영/갤러리 선택 UI를 노출한다", async () => {
    const { fetchFinishPhotoUrl } = await import("../lib/finishPhoto");
    fetchFinishPhotoUrl.mockResolvedValue(null);

    render(<FinishPhotoSection />);

    expect(await screen.findByText("아직 등록된 완주 인증 사진이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("완주 사진 촬영하기")).toBeInTheDocument();
    expect(screen.getByText("카메라가 안 열리나요? 갤러리에서 선택하기")).toBeInTheDocument();
    expect(screen.queryByText("다시 시도")).not.toBeInTheDocument();
  });

  it("사진 미등록 상태에서 파일을 선택하고 저장하면 uploadFinishPhoto를 호출하고 onPhotoUploaded를 알린다", async () => {
    const { fetchFinishPhotoUrl, uploadFinishPhoto } = await import("../lib/finishPhoto");
    fetchFinishPhotoUrl.mockResolvedValueOnce(null).mockResolvedValueOnce("https://example.com/new.jpg");
    uploadFinishPhoto.mockResolvedValue({ success: true });
    const onPhotoUploaded = vi.fn();
    const user = userEvent.setup();

    const { container } = render(<FinishPhotoSection onPhotoUploaded={onPhotoUploaded} />);

    await screen.findByText("완주 사진 촬영하기");

    const file = new File(["fake"], "finish.jpg", { type: "image/jpeg" });
    const fileInput = container.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    const saveButton = await screen.findByText("사진 저장하기");
    await user.click(saveButton);

    await waitFor(() => {
      expect(uploadFinishPhoto).toHaveBeenCalledWith(file);
    });
    expect(onPhotoUploaded).toHaveBeenCalled();
  });

  it("조회 자체가 실패하면(오류) 다시 시도 버튼을 노출한다", async () => {
    const { fetchFinishPhotoUrl } = await import("../lib/finishPhoto");
    fetchFinishPhotoUrl.mockRejectedValue(new Error("네트워크 오류"));

    render(<FinishPhotoSection />);

    expect(await screen.findByText("네트워크 오류")).toBeInTheDocument();
    expect(screen.getByText("다시 시도")).toBeInTheDocument();
  });
});
