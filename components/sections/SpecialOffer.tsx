export default function SpecialOffer() {
  return (
    <section id="special" className="relative z-20 mx-auto mt-8 max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] bg-linear-to-r from-red-700 via-primary to-orange-600 p-[1px] shadow-glow-primary">
        <div className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-[linear-gradient(135deg,#111827,#1f2937)] px-6 py-8 md:px-10">
          <div className="absolute right-0 top-0 opacity-10 blur-xl">
            <svg width="220" height="220" fill="white" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="50" />
            </svg>
          </div>

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.3fr_0.85fr] lg:items-center">
            <div>
              <span className="inline-flex rounded-full border border-red-300/30 bg-red-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-red-100">
                Ưu tiên kiểm tra trước
              </span>
              <h2 className="mt-4 font-heading text-2xl font-bold text-white md:text-3xl">
                Hỗ trợ test và kiểm tra pin miễn phí cho khách cần làm rõ trước khi quyết định.
              </h2>
              <p className="mt-3 max-w-2xl font-body text-base leading-7 text-slate-300 md:text-lg">
                Phù hợp cho thợ, chủ thiết bị và khách đang gặp pin ngắt, chai hoặc không rõ tình
                trạng thực tế. Minh Hồng ưu tiên kiểm tra, đo nội trở, test dòng xả rồi mới tư vấn
                phương án phù hợp.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                    Không thu phí
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">Kiểm tra ban đầu và tư vấn tại chỗ.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                    Nói rõ tình trạng
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    Phân tích khả năng phục hồi hoặc thay mới trước khi làm.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                    Phù hợp nhiều thiết bị
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    Xe điện, loa kéo, pin lưu trữ và dụng cụ cầm tay.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-100">
                Tư vấn trực tiếp tại xưởng
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-white">
                  <p className="text-xs uppercase tracking-wide text-red-100">Điểm tiếp nhận</p>
                  <p className="mt-2 font-heading text-xl font-bold">Xã Đồng Dương, TP. Đà Nẵng</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-white">
                  <p className="text-xs uppercase tracking-wide text-red-100">Phù hợp nếu bạn cần</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Mang thiết bị tới để nghe tư vấn ngay, kiểm tra nhanh rồi mới quyết định sửa hay
                    thay.
                  </p>
                </div>
              </div>
              <a
                href="https://maps.app.goo.gl/gCtACM49w2sPEc5dA"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-yellow-400 px-6 py-4 text-center font-heading text-lg font-black text-slate-900 shadow-glow-secondary transition-colors hover:bg-yellow-300"
              >
                Chỉ đường tới nơi
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
