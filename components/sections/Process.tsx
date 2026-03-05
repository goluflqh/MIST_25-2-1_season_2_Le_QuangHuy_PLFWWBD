export default function Process() {
  return (
    <section id="process" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-white relative z-10 rounded-[3rem] shadow-sm mb-12 border border-slate-100">
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <span className="text-primary font-bold tracking-widest uppercase text-sm mb-2 block">
          Minh Bạch & Rõ Ràng
        </span>
        <h2 className="font-heading font-extrabold text-4xl text-textMain mb-6">
          Quy Trình Sửa Chữa & Lắp Đặt
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-primary to-orange-500 mx-auto rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
        {/* Connecting Line for Desktop */}
        <div className="hidden md:block absolute top-[45px] left-[10%] right-[10%] h-0.5 bg-slate-200 z-0"></div>

        {/* Step 1 */}
        <div className="relative z-10 flex flex-col items-center text-center group">
          <div className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center text-primary mb-6 group-hover:-translate-y-2 group-hover:bg-red-50 group-hover:border-red-100 transition-all duration-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
            </svg>
          </div>
          <span className="bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm absolute -top-2 right-1/4 md:right-4 shadow-lg">
            1
          </span>
          <h4 className="font-heading font-bold text-xl mb-3 text-textMain">
            Khảo Sát & Đo Đạc
          </h4>
          <p className="font-body text-slate-500 text-sm px-2">
            Kỹ thuật viên kiểm tra nội trở pin hoặc khảo sát góc nhìn camera hoàn toàn miễn phí.
          </p>
        </div>

        {/* Step 2 */}
        <div className="relative z-10 flex flex-col items-center text-center group">
          <div className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center text-yellow-500 mb-6 group-hover:-translate-y-2 group-hover:bg-yellow-50 group-hover:border-yellow-100 transition-all duration-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <span className="bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm absolute -top-2 right-1/4 md:right-4 shadow-lg">
            2
          </span>
          <h4 className="font-heading font-bold text-xl mb-3 text-textMain">
            Báo Giá Công Khai
          </h4>
          <p className="font-body text-slate-500 text-sm px-2">
            Đề xuất phương án tối ưu nhất, tư vấn lựa chọn dung lượng và linh kiện chuẩn.
          </p>
        </div>

        {/* Step 3 */}
        <div className="relative z-10 flex flex-col items-center text-center group">
          <div className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center text-orange-500 mb-6 group-hover:-translate-y-2 group-hover:bg-orange-50 group-hover:border-orange-100 transition-all duration-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <span className="bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm absolute -top-2 right-1/4 md:right-4 shadow-lg">
            3
          </span>
          <h4 className="font-heading font-bold text-xl mb-3 text-textMain">
            Thi công & Lắp Ráp
          </h4>
          <p className="font-body text-slate-500 text-sm px-2">
            Đóng cell bằng máy hàn điểm chuyên nghiệp hoặc bắt vít lắp đặt camera chắc chắn.
          </p>
        </div>

        {/* Step 4 */}
        <div className="relative z-10 flex flex-col items-center text-center group">
          <div className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center text-green-500 mb-6 group-hover:-translate-y-2 group-hover:bg-green-50 group-hover:border-green-100 transition-all duration-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <span className="bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm absolute -top-2 right-1/4 md:right-4 shadow-lg">
            4
          </span>
          <h4 className="font-heading font-bold text-xl mb-3 text-textMain">
            KCS & Bàn Giao
          </h4>
          <p className="font-body text-slate-500 text-sm px-2">
            Chạy test tải nặng thực tế, kiểm tra hình ảnh camera, dán tem bảo hành và bàn giao.
          </p>
        </div>
      </div>
    </section>
  );
}
