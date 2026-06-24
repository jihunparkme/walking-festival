const SESSION_KEY = "wf_admin_pw";

export function getAdminPassword() {
  return sessionStorage.getItem(SESSION_KEY);
}

export function saveAdminPassword(pw) {
  sessionStorage.setItem(SESSION_KEY, pw);
}

export function clearAdminPassword() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function verifyAdminPassword(password) {
  const res = await fetch("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "비밀번호가 올바르지 않습니다.");
  }
  return true;
}

function adminHeaders() {
  return { "x-admin-password": getAdminPassword() };
}

export async function fetchAdminParticipants({ search = "", page = 1 } = {}) {
  const params = new URLSearchParams({ page });
  if (search.trim()) params.set("search", search.trim());
  const res = await fetch(`/api/admin/participants?${params}`, {
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error("참여자 정보를 불러오는 중 오류가 발생했습니다.");
  return res.json();
}

export async function fetchAdminBooths() {
  const res = await fetch("/api/admin/booths", { headers: adminHeaders() });
  if (!res.ok) throw new Error("부스 정보를 불러오는 중 오류가 발생했습니다.");
  return res.json();
}

export async function createAdminBooth(booth) {
  const res = await fetch("/api/admin/booths", {
    method: "POST",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(booth),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "부스 추가 중 오류가 발생했습니다.");
  }
  return res.json();
}

export async function updateAdminBooth(id, updates) {
  const res = await fetch(`/api/admin/booths?id=${id}`, {
    method: "PATCH",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "부스 수정 중 오류가 발생했습니다.");
  }
  return res.json();
}

export async function deleteAdminBooth(id) {
  const res = await fetch(`/api/admin/booths?id=${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "부스 삭제 중 오류가 발생했습니다.");
  }
  return res.json();
}
