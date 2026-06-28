import { useEffect, useRef, useState } from "react";
import {
  createAdminBooth,
  deleteAdminBooth,
  fetchAdminBooths,
  fetchAdminParticipants,
  updateAdminBooth,
} from "../lib/admin";

// ─── 참여자 탭 ──────────────────────────────────────────────────────────────

function ParticipantsTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const PAGE_SIZE = 20;
  const debounceRef = useRef(null);

  async function load(searchVal, pageVal) {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAdminParticipants({ search: searchVal, page: pageVal });
      setRows(res.data ?? []);
      setTotal(res.count ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // 타이핑 시 300ms 디바운스 후 검색
  function handleInputChange(e) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(val);
    }, 300);
  }

  useEffect(() => {
    load(search, page);
  }, [search, page]);

  function handleReset() {
    clearTimeout(debounceRef.current);
    setSearchInput("");
    setPage(1);
    setSearch("");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // participants 컬럼을 동적으로 감지
  const knownKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
  const showStart = knownKeys.includes("start_done") || knownKeys.includes("is_start");
  const showReturn = knownKeys.includes("return_done") || knownKeys.includes("is_return");
  const showComplete =
    knownKeys.includes("complete_done") ||
    knownKeys.includes("is_complete") ||
    knownKeys.includes("is_completed");

  function getBoolVal(row, ...candidates) {
    for (const k of candidates) {
      if (k in row) return row[k];
    }
    return null;
  }

  function BoolBadge({ value }) {
    if (value === null) return <span className="text-[#aab5c5]">-</span>;
    return value ? (
      <span className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-xs font-bold text-[#065f46]">완료</span>
    ) : (
      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs font-bold text-[#6b7280]">미완료</span>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          placeholder="이름 또는 전화번호 검색"
          className="flex-1 rounded-2xl border border-[#c9d5e5] px-3 py-2 text-sm outline-none focus:border-[#ff99bb]"
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full bg-[#ccd6e4] px-4 py-2 text-sm font-bold"
          >
            초기화
          </button>
        )}
      </div>

      <p className="text-xs text-[#8a9ab5]">
        총 <span className="font-bold text-[#1a2a3a]">{total}</span>명
        {search && <span> · 검색: "{search}"</span>}
      </p>

      {error && (
        <p className="rounded-xl bg-[#fff0f4] px-3 py-2 text-xs text-[#d94a70]">{error}</p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-[#8a9ab5]">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#8a9ab5]">참여자가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e2ecf5]">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f9fc] text-left text-xs font-semibold text-[#5f6f88]">
              <tr>
                <th className="px-3 py-2.5">No.</th>
                <th className="px-3 py-2.5">이름</th>
                <th className="px-3 py-2.5">전화번호</th>
                <th className="px-3 py-2.5 text-center">추첨번호</th>
                {showStart && <th className="px-3 py-2.5 text-center">시작점</th>}
                {showReturn && <th className="px-3 py-2.5 text-center">반환점</th>}
                {showComplete && <th className="px-3 py-2.5 text-center">완주</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f8]">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-[#fafbfd]">
                  <td className="px-3 py-2.5 text-[#8a9ab5]">
                    {(page - 1) * PAGE_SIZE + idx + 1}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[#1a2a3a]">{row.name}</td>
                  <td className="px-3 py-2.5 text-[#4e5f75]">{row.phone}</td>
                  <td className="px-3 py-2.5 text-center font-mono font-bold text-[#ff99bb]">
                    {String(row.id).padStart(6, "0")}
                  </td>
                  {showStart && (
                    <td className="px-3 py-2.5 text-center">
                      <BoolBadge value={getBoolVal(row, "start_done", "is_start")} />
                    </td>
                  )}
                  {showReturn && (
                    <td className="px-3 py-2.5 text-center">
                      <BoolBadge value={getBoolVal(row, "return_done", "is_return")} />
                    </td>
                  )}
                  {showComplete && (
                    <td className="px-3 py-2.5 text-center">
                      <BoolBadge value={getBoolVal(row, "complete_done", "is_complete", "is_completed")} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-xs font-bold disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs text-[#5f6f88]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-xs font-bold disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 부스 탭 ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = { booth_id: "", title: "", subtitle: "" };

function BoothForm({ initial = EMPTY_FORM, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      booth_id: form.booth_id.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[#c9d5e5] bg-[#f7f9fc] p-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#3a4a5c]">부스 ID *</label>
        <input
          type="text"
          value={form.booth_id}
          onChange={(e) => set("booth_id", e.target.value)}
          required
          className="w-full rounded-xl border border-[#c9d5e5] px-3 py-2 text-sm outline-none focus:border-[#ff99bb]"
          placeholder="QR 코드에 사용되는 고유 ID (예: booth-1)"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#3a4a5c]">부스명 *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
          className="w-full rounded-xl border border-[#c9d5e5] px-3 py-2 text-sm outline-none focus:border-[#ff99bb]"
          placeholder="부스 이름"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#3a4a5c]">부제목 *</label>
        <input
          type="text"
          value={form.subtitle}
          onChange={(e) => set("subtitle", e.target.value)}
          className="w-full rounded-xl border border-[#c9d5e5] px-3 py-2 text-sm outline-none focus:border-[#ff99bb]"
          placeholder="부제목"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#ff99bb] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-[#ccd6e4] px-5 py-2 text-sm font-bold"
        >
          취소
        </button>
      </div>
    </form>
  );
}

function BoothsTab() {
  const [booths, setBooths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAdminBooths();
      setBooths(res.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(form) {
    setSaving(true);
    try {
      await createAdminBooth(form);
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id, form) {
    setSaving(true);
    try {
      await updateAdminBooth(id, form);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    try {
      await deleteAdminBooth(id);
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#8a9ab5]">
          총 <span className="font-bold text-[#1a2a3a]">{booths.length}</span>개 부스
        </p>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            setEditingId(null);
          }}
          className="rounded-full bg-[#ff99bb] px-4 py-2 text-sm font-bold text-white"
        >
          + 부스 추가
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-[#fff0f4] px-3 py-2 text-xs text-[#d94a70]">{error}</p>
      )}

      {showAdd && (
        <BoothForm
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          saving={saving}
        />
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-[#8a9ab5]">불러오는 중…</p>
      ) : booths.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#8a9ab5]">등록된 부스가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {booths.map((booth) => (
            <div key={booth.id} className="rounded-2xl border border-[#e2ecf5] bg-white p-4">
              {editingId === booth.id ? (
                <BoothForm
                  initial={{
                    booth_id: booth.booth_id ?? "",
                    title: booth.title,
                    subtitle: booth.subtitle ?? "",
                  }}
                  onSave={(form) => handleUpdate(booth.id, form)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#eef2f8] px-2 py-0.5 text-xs text-[#5f6f88]">
                          {booth.booth_id}
                        </span>
                        <p className="font-bold text-[#1a2a3a]">{booth.title}</p>
                      </div>
                      {booth.subtitle && (
                        <p className="mt-0.5 text-xs text-[#7a8a9e]">{booth.subtitle}</p>
                      )}
                      <p className="mt-1.5 text-xs text-[#5f6f88]">
                        참여 인원:{" "}
                        <span className="font-bold text-[#ff99bb]">
                          {booth.participant_count}명
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(booth.id);
                          setShowAdd(false);
                        }}
                        className="rounded-xl bg-[#eef2f8] px-3 py-1.5 text-xs font-bold text-[#3a4a5c] hover:bg-[#e0e9f5]"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(booth.id)}
                        className="rounded-xl bg-[#fff0f4] px-3 py-1.5 text-xs font-bold text-[#d94a70] hover:bg-[#ffd6e4]"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-soft">
            <h4 className="text-base font-extrabold text-[#1a2a3a]">부스를 삭제하시겠습니까?</h4>
            <p className="mt-1 text-xs text-[#5f6f88]">
              삭제된 부스는 복구할 수 없습니다. 해당 부스의 도장 기록도 함께 삭제될 수 있습니다.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-full bg-[#ccd6e4] py-2 text-sm font-bold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={saving}
                className="flex-1 rounded-full bg-[#d94a70] py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 관리자 메인 페이지 ────────────────────────────────────────────────────────

const TABS = [
  { id: "participants", label: "👥 참여자 관리" },
  { id: "booths", label: "🏕️ 부스 관리" },
];

export default function AdminPage({ onExit }) {
  const [activeTab, setActiveTab] = useState("participants");

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#f7f9fc]">
      {/* 헤더 */}
      <header className="shrink-0 bg-white shadow-soft">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-extrabold text-[#1a2a3a]">관리자 페이지</h1>
            <p className="text-xs text-[#8a9ab5]">사람사랑 생명사랑 걷기캠페인</p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full bg-[#eef2f8] px-4 py-2 text-sm font-bold text-[#3a4a5c]"
          >
            ← 돌아가기
          </button>
        </div>

        {/* 탭 */}
        <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                activeTab === t.id
                  ? "bg-[#ff99bb] text-white"
                  : "bg-[#eef2f8] text-[#5f6f88] hover:bg-[#e0e9f5]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* 콘텐츠 — 헤더 아래 영역을 채우며 독립 스크롤 */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {activeTab === "participants" ? <ParticipantsTab /> : <BoothsTab />}
        </div>
      </main>
    </div>
  );
}
