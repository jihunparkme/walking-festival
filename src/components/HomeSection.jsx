import org1 from "../assets/images/org_1.jpeg";
import org2 from "../assets/images/org_2.jpeg";

export default function HomeSection({ lotteryNumber, participantName, onAdminClick }) {

  return (
    <>
      {participantName && (
        <section className="soft-card flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-200/60 text-xl">
            👋
          </div>
          <p className="text-base font-bold text-[#1a2a3a]">
            {participantName}님, 환영합니다!
            <br/><span className="text-sm font-normal text-[#5b6c84]">오늘도 따뜻한 걸음 함께해요.</span>
          </p>
        </section>
      )}
      <section className="soft-card space-y-5 p-4 md:p-7">
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-xl font-bold">축제 안내</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-[#4e5f75]">
              <p>
                세계 자살 예방의 날을 맞아 시민이 함께 걸으며 서로의 안부를 묻고 생명존중문화를 만들어가는「사람사랑 생명사랑 걷기캠페인」에 여러분을 초대합니다.
              </p>
              <p>
                누구에게나 힘든 순간은 찾아옵니다. 하지만 여전히 많은 사람들이 그 시간을 혼자 견디고 있습니다.
                2024년 한 해 약 1만 5천여 명이 스스로 생을 마감했고, 하루 평균 약 41명이 소중한 생명을 잃었습니다.
                이러한 현실은 우리 모두의 관심과 연결이 얼마나 중요한지 다시 한번 일깨워 줍니다.
              </p>
              <p>
                그래서 우리는 올해도 함께 걷습니다. 함께 걷는 한 걸음이 서로의 안부를 묻고, 생명을 존중하는 문화를 만들어갑니다.
              </p>
              <p className="font-semibold text-[#3a4a5c]">
                여러분의 참여가 생명을 잇는 따뜻한 시작이 됩니다. 많은 관심과 참여 부탁드립니다.
              </p>
            </div>
          </div>
          <div className="rounded-bubble bg-skyMint p-4">
            <p className="text-sm font-semibold text-[#546378]">협력기관</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-white/90 p-3">
                <img src={org1} alt="안양월드휴먼브리지" className="h-10 w-10 animate-bob rounded-full object-cover" />
                <div>
                  <p className="text-sm font-bold">안양월드휴먼브리지</p>
                  <p className="text-xs text-[#60718a]">생명사랑 네트워크 파트너</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/90 p-3">
                <img src={org2} alt="율목종합사회복지관" className="h-10 w-10 animate-bob rounded-full object-cover" />
                <div>
                  <p className="text-sm font-bold">율목종합사회복지관</p>
                  <p className="text-xs text-[#60718a]">지역사회 연계 협력기관</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {lotteryNumber && (
        <section className="soft-card p-4 md:p-7">
          <h2 className="text-xl font-bold">나의 추첨번호</h2>
          <p className="mt-1 text-sm text-[#5f6f88]">추첨 이벤트에 사용되는 나의 번호입니다.</p>
          <div className="mt-4 rounded-2xl bg-[#eff6ff] px-4 py-4 text-center">
            <p className="text-3xl font-extrabold tracking-widest text-[#3b82f6]">{lotteryNumber}</p>
          </div>
        </section>
      )}

      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={onAdminClick}
          className="text-[10px] text-[#b0bdd0] hover:text-[#8a9ab5] underline"
        >
          관리자
        </button>
      </div>
    </>
  );
}
