export default function ChallengeCompleteModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-soft">
        <p className="text-4xl">🎉</p>
        <h3 className="mt-2 text-lg font-extrabold text-[#1a2a3a]">챌린지 완료!</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#4e5f75]">
          6번 생명사랑지킴이 챌린지부스에서
          <br />
          상품을 받아가세요!
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-[#06539D] py-2.5 text-sm font-bold text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
