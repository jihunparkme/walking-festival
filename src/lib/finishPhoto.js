/** 이미지 파일을 base64 data URL로 변환합니다. */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 업로드 전 리사이즈 기준 (가로/세로 중 긴 변 기준, px) 및 JPEG 재인코딩 품질
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * 모바일 카메라 원본 사진(수 MB)을 base64로 그대로 전송하면 페이로드가 커지고
 * 서버리스 함수 요청 크기 제한에 걸릴 수 있어, 업로드 전 캔버스로 리사이즈 +
 * JPEG 재인코딩해 용량을 줄입니다. 리사이즈에 실패하면(구형 브라우저 등) 원본
 * 파일을 그대로 사용해 업로드 자체가 막히지 않도록 합니다.
 */
export async function compressImage(file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * 완주 인증 사진을 업로드합니다. (완주 QR 인증이 먼저 완료되어 있어야 합니다)
 * HttpOnly 쿠키로 참여자를 식별하므로 별도 인증 헤더 불필요.
 * 파일명은 서버가 세션의 이름/전화번호로 직접 생성합니다.
 */
export async function uploadFinishPhoto(file) {
  if (!file.type?.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }

  const compressed = await compressImage(file);
  const fileBase64 = await fileToBase64(compressed);
  const res = await fetch("/api/finish-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, contentType: compressed.type }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "사진 업로드 중 오류가 발생했습니다.");
  }
  return json;
}

/**
 * 등록된 완주 인증 사진의 서명된 URL(임시, private 버킷)을 조회합니다.
 * HttpOnly 쿠키로 참여자를 식별하므로 별도 인증 헤더 불필요.
 */
export async function fetchFinishPhotoUrl() {
  const res = await fetch("/api/finish-photo", { method: "GET" });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "사진을 불러오는 중 오류가 발생했습니다.");
  }
  return json.url;
}
