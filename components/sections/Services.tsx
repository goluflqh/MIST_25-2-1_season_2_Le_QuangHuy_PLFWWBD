import Link from "next/link";

export default function Services() {
  return (
    <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <h2 className="font-heading font-extrabold text-4xl text-textMain mb-6">Dịch Vụ Trọng Tâm</h2>
        <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto mb-6 rounded-full"></div>
        <p className="font-body text-slate-600 text-lg">
          Tập trung chuyên môn cao nhất vào hai mảng dịch vụ chính, nhằm mang lại chất lượng và sự an tâm tuyệt đối cho khách hàng.
        </p>
      </div>

      <div className="flex flex-col gap-12">
        {/* Service 1: Đóng Pin (Left Image, Right Content) */}
        <div className="glass-panel rounded-3xl overflow-hidden flex flex-col md:flex-row hover:shadow-2xl transition-shadow duration-500 group border-l-4 border-l-primary">
          <div className="md:w-5/12 h-64 md:h-auto relative overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1617711481197-07eaaf9a7d30?auto=format&fit=crop&w=800&q=80"
              alt="Đóng Pin Chuyên Nghiệp"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute top-4 left-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase shadow-lg backdrop-blur-md">
              🔋 Năng Lượng
            </div>
          </div>
          <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center">
            <h3 className="font-heading font-bold text-3xl text-textMain mb-4">
              Chuyên Đóng Pin <span className="text-primary">Lithium Cao Cấp</span>
            </h3>
            <p className="font-body text-slate-600 mb-6 text-lg">
              Cam kết sử dụng Cell pin chuẩn chính hãng, mạch bảo vệ BMS thông minh. Phục hồi 100% sinh lực thiết bị.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start gap-3">
                <span className="bg-red-100 text-primary p-1.5 rounded-lg shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </span>
                <span className="font-body font-medium text-slate-700">Pin Xe Điện, Loa Kéo</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-red-100 text-primary p-1.5 rounded-lg shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path>
                  </svg>
                </span>
                <span className="font-body font-medium text-slate-700">Pin Máy Công Cụ Cầm Tay</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-red-100 text-primary p-1.5 rounded-lg shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                  </svg>
                </span>
                <span className="font-body font-medium text-slate-700">Pin Lưu Trữ, Kích Đề</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-red-100 text-primary p-1.5 rounded-lg shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                </span>
                <span className="font-body font-medium text-slate-700">Pin Đèn Năng Lượng</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-body text-sm font-bold text-slate-700 text-center mb-6">
              ĐẶC BIỆT: Nhận đóng bình thủ công theo mọi yêu cầu thông số của khách!
            </div>

            <Link href="/bao-gia" className="w-max bg-slate-900 hover:bg-primary text-white font-body font-bold py-3 px-8 rounded-xl transition-colors ring-1 ring-slate-900 hover:ring-0 inline-block">
              Tham khảo Bảng Giá Nhỏ
            </Link>
          </div>
        </div>

        {/* Service 2: Camera (Right Image, Left Content) */}
        <div className="glass-panel rounded-3xl overflow-hidden flex flex-col md:flex-row-reverse hover:shadow-2xl transition-shadow duration-500 group border-r-4 border-r-blue-500">
          <div className="md:w-5/12 h-64 md:h-auto relative overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1557597774-9d273e3814de?auto=format&fit=crop&q=80&w=800"
              alt="Lắp Đặt Camera An Ninh"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase shadow-lg backdrop-blur-md">
              🎥 An Ninh
            </div>
          </div>
          <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center">
            <h3 className="font-heading font-bold text-3xl text-textMain mb-4">
              Lắp Đặt <span className="text-blue-600">Camera An Ninh</span> Uy Tín
            </h3>
            <p className="font-body text-slate-600 mb-6 text-lg">
              Khảo sát tận nơi, tư vấn góc nhìn không điểm mù. Hệ thống chạy ổn định 24/7, đàm thoại 2 chiều và quay đêm siêu chuẩn.
            </p>

            <ul className="font-body text-slate-700 mb-8 space-y-3 font-medium">
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> 
                <b>Bảo hành kỹ thuật tận nơi 12 - 24 tháng.</b>
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> 
                Cài đặt ứng dụng xem trên điện thoại miễn phí.
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> 
                Giải pháp dành cho cửa hàng, kho bãi và gia đình.
              </li>
            </ul>

            <Link href="/#quote" className="w-max bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 font-body font-bold py-3 px-8 rounded-xl transition-colors inline-block">
              Yêu Cầu Khảo Sát Tận Nơi
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
