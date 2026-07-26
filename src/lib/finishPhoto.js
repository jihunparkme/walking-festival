/** 이미지 파일을 base64 data URL로 변환합니다. */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  const fileBase64 = await fileToBase64(file);
  const res = await fetch("/api/finish-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, contentType: file.type }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "사진 업로드 중 오류가 발생했습니다.");
  }
  return json;
}
