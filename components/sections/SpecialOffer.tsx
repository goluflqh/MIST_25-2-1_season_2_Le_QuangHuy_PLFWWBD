import Link from "next/link";

export default function SpecialOffer() {
  return (
    <section id="special" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-20 mt-12">
      <div className="bg-gradient-to-r from-red-700 via-primary to-orange-600 rounded-3xl p-1 shadow-glow-primary hover:-translate-y-1 transition-transform duration-300">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[22px] px-6 py-8 md:px-10 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute right-0 top-0 opacity-10 blur-xl">
            <svg width="200" height="200" fill="white" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="50" />
            </svg>
          </div>

          <div className="relative z-10 flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="animate-pulse bg-red-500 text-white text-xs font-black uppercase px-3 py-1 rounded-full tracking-widest">
                Đặc Biệt Dành Riêng Cho Thợ
              </span>
            </div>
            <h2 className="font-heading font-bold text-2xl md:text-3xl text-white mb-2">
              Hỗ Trợ Test & Kiểm Tra Pin <span className="text-yellow-400">Miễn Phí 100%</span>
            </h2>
            <p className="font-body text-slate-300 text-lg">
              Nếu pin anh em đang dùng bị ngắt, chai, trục trặc – mang qua ngay tận nơi. Kỹ thuật viên sẽ{" "}
              <b>đo nội trở, test dòng xả và tư vấn tận tình tại chỗ</b>, không thu phí!
            </p>
          </div>

          <div className="relative z-10 shrink-0">
            <a
              href="https://maps.app.goo.gl/gCtACM49w2sPEc5dA"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-heading font-black px-8 py-4 rounded-xl text-lg flex items-center gap-2 shadow-glow-secondary transition-colors"
            >
              📍 Chỉ Đường Tới Nơi
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
