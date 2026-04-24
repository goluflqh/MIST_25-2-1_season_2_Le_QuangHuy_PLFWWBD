export default function SpecialOffer() {
  const points = [
    {
      label: "Test 0đ",
      text: "Kiểm tra sơ bộ pin miễn phí trước khi báo hướng xử lý.",
    },
    {
      label: "Không ép sửa",
      text: "Khách nghe rõ tình trạng rồi tự quyết định làm hay chưa.",
    },
    {
      label: "Báo rõ chi phí",
      text: "Tách phần cần làm ngay và phần có thể chờ.",
    },
  ] as const;

  return (
    <section id="special" className="relative z-20 mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-10 lg:px-8">
      <div className="overflow-hidden rounded-[1.45rem] border border-red-500/20 bg-[linear-gradient(135deg,#7f1d1d,#dc2626_48%,#f97316)] p-1 shadow-[0_30px_100px_-42px_rgba(127,29,29,0.55)] sm:rounded-[1.75rem]">
        <div className="rounded-[1.25rem] bg-slate-950/84 p-5 text-white backdrop-blur sm:rounded-[1.55rem] sm:p-6 md:p-8">
        <div className="grid gap-7 lg:grid-cols-[1.08fr_0.78fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-yellow-300/40 bg-yellow-300 px-3 py-1 text-sm font-black text-slate-950 shadow-[0_12px_40px_-24px_rgba(253,224,71,0.8)]">
              Miễn phí kiểm tra pin
            </span>
            <h2 className="mt-4 text-pretty font-heading text-[2rem] font-extrabold leading-tight text-white md:text-4xl">
              Kiểm tra pin 0đ, rồi mới quyết định sửa.
            </h2>
            <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-red-50 sm:text-base sm:leading-7">
              Phù hợp khi pin ngắt, chai nhanh hoặc sạc không vào. Kỹ thuật test sơ bộ miễn phí,
              nói rõ tình trạng và hướng xử lý trước khi khách chốt sửa, thay cell hoặc đóng bộ mới.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {points.map((point) => (
                <div
                  key={point.label}
                  className="flex items-start gap-3 rounded-[1.15rem] border border-white/12 bg-white/9 px-3.5 py-3.5"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-xs font-black text-slate-950 sm:mt-0.5">
                    ✓
                  </span>
                  <div>
                    <p className="font-heading text-sm font-extrabold leading-5 text-white sm:text-base">
                      {point.label}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-5 text-red-50 sm:text-sm sm:leading-6">
                      {point.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-4 backdrop-blur sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[0.45fr_1fr] lg:grid-cols-1">
              <div className="rounded-2xl border border-yellow-300/40 bg-yellow-300 p-4 text-slate-950">
                <p className="font-heading text-5xl font-black leading-none sm:text-4xl">0đ</p>
                <p className="mt-1 text-sm font-black">kiểm tra pin sơ bộ</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/32 p-4 text-white">
                <p className="text-sm font-semibold text-red-100">Quyền lợi rõ ràng</p>
                <p className="mt-1.5 font-heading text-lg font-bold">Test miễn phí, báo thật tình trạng</p>
                <p className="mt-2 text-xs leading-5 text-slate-200 sm:text-sm sm:leading-6">
                  Mang pin hoặc thiết bị tới Minh Hồng ở Xã Đồng Dương, TP. Đà Nẵng để kiểm tra nhanh trước khi sửa.
                </p>
              </div>
            </div>
            <a
              href="https://maps.app.goo.gl/gCtACM49w2sPEc5dA"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-yellow-400 px-6 py-3.5 text-center font-heading text-base font-black text-slate-900 transition-colors hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-200"
            >
              Đến kiểm tra miễn phí
            </a>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
