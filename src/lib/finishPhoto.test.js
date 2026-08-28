// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compressImage, uploadFinishPhoto } from "./finishPhoto.js";

/** jsdom은 canvas 2D context/toBlob을 구현하지 않으므로 필요한 만큼만 모킹한다. */
function mockCanvas({ toBlobResult } = {}) {
  const ctx = { drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb) {
    cb(toBlobResult === undefined ? new Blob(["fake"], { type: "image/jpeg" }) : toBlobResult);
  });
  return ctx;
}

function mockCreateImageBitmap(bitmap) {
  global.createImageBitmap = vi.fn().mockResolvedValue(bitmap);
}

describe("compressImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete global.createImageBitmap;
  });

  it("downscales an image whose longer side exceeds maxDimension and re-encodes as JPEG", async () => {
    const ctx = mockCanvas();
    mockCreateImageBitmap({ width: 4000, height: 2000, close: vi.fn() });
    const file = new File(["original"], "photo.png", { type: "image/png" });

    const result = await compressImage(file, { maxDimension: 1600, quality: 0.82 });

    // 가로가 긴 변이므로 4000 -> 1600 스케일(0.4)이 세로에도 동일 적용되어야 함
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800);
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("photo.png");
  });

  it("does not upscale images already smaller than maxDimension", async () => {
    const ctx = mockCanvas();
    mockCreateImageBitmap({ width: 800, height: 600, close: vi.fn() });
    const file = new File(["original"], "small.png", { type: "image/png" });

    await compressImage(file, { maxDimension: 1600, quality: 0.82 });

    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
  });

  it("falls back to the original file when createImageBitmap throws (e.g. unsupported format/old browser)", async () => {
    mockCanvas();
    global.createImageBitmap = vi.fn().mockRejectedValue(new Error("unsupported image type"));
    const file = new File(["original"], "photo.heic", { type: "image/heic" });

    const result = await compressImage(file);

    expect(result).toBe(file);
  });

  it("falls back to the original file when canvas.toBlob yields null (encoding failure)", async () => {
    mockCanvas({ toBlobResult: null });
    mockCreateImageBitmap({ width: 2000, height: 1000, close: vi.fn() });
    const file = new File(["original"], "photo.png", { type: "image/png" });

    const result = await compressImage(file);

    expect(result).toBe(file);
  });
});

describe("uploadFinishPhoto", () => {
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    mockCanvas();
    mockCreateImageBitmap({ width: 3200, height: 1600, close: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.createImageBitmap;
    global.fetch = ORIGINAL_FETCH;
  });

  it("rejects non-image files before attempting compression/upload", async () => {
    const file = new File(["not an image"], "doc.pdf", { type: "application/pdf" });
    await expect(uploadFinishPhoto(file)).rejects.toThrow("이미지 파일만 업로드할 수 있습니다.");
  });

  it("sends the compressed file's contentType (image/jpeg), not the original file's type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = fetchMock;

    const file = new File(["original"], "photo.png", { type: "image/png" });
    await uploadFinishPhoto(file);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.contentType).toBe("image/jpeg");
  });
});
