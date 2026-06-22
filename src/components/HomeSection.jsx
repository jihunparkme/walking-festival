import org1 from "../assets/images/org_1.jpeg";
import org2 from "../assets/images/org_2.jpeg";

export default function HomeSection() {
  return (
    <section className="soft-card space-y-5 p-4 md:p-7">
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="text-xl font-bold">축제 안내</h2>
          <p className="mt-3 leading-relaxed text-[#4e5f75]">
            세계자살예방의 날을 맞아, 안양 시민이 함께 걷고 소통하며 생명존중 문화를 확산하는 캠페인입니다.
            <br/>
            5개 미션 부스를 체험하고 완보 인증까지 완료하면 추첨 이벤트에 참여할 수 있습니다.
            <br/>
          </p>
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
  );
}
