export default function Process() {
  const steps = [
    {
      step: "1",
      title: "Khảo sát và kiểm tra",
      description:
        "Kiểm tra nội trở pin, tình trạng tải hoặc khảo sát vị trí lắp camera để hiểu đúng nhu cầu thực tế.",
      accent: "border-red-100 bg-red-50 text-primary",
      iconPath:
        "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4",
    },
    {
      step: "2",
      title: "Báo giá công khai",
      description:
        "Giải thích lựa chọn linh kiện, phương án thi công và mức chi phí để khách có đủ thông tin trước khi quyết định.",
      accent: "border-amber-100 bg-amber-50 text-amber-700",
      iconPath:
        "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      step: "3",
      title: "Thi công đúng bài toán",
      description:
        "Đóng cell, dựng mạch hoặc đi dây camera với ưu tiên độ bền, tính gọn gàng và khả năng vận hành ổn định.",
      accent: "border-orange-100 bg-orange-50 text-orange-700",
      iconPath:
        "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    },
    {
      step: "4",
      title: "KCS và bàn giao",
      description:
        "Chạy thử, đối chiếu kết quả, hướng dẫn sử dụng và giữ liên hệ để khách yên tâm sau khi nhận bàn giao.",
      accent: "border-emerald-100 bg-emerald-50 text-emerald-700",
      iconPath: "M5 13l4 4L19 7",
    },
  ] as const;

  return (
    <section
      id="process"
      className="relative z-10 mx-auto mb-12 max-w-7xl rounded-[3rem] border border-slate-100 bg-white px-4 py-16 shadow-sm sm:px-6 lg:px-8"
    >
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <span className="block text-sm font-bold uppercase tracking-[0.22em] text-primary">
          Minh bạch và rõ ràng
        </span>
        <h2 className="mb-6 mt-3 font-heading text-4xl font-extrabold text-textMain">
          Quy Trình Sửa Chữa & Lắp Đặt
        </h2>
        <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-primary to-orange-500"></div>
        <p className="mt-6 font-body text-lg leading-8 text-slate-600">
          Cùng một quy trình cho cả pin lẫn camera: khảo sát trước, nói rõ phương án, thi công đúng
          bài toán và bàn giao có trách nhiệm.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.step}
            className="rounded-[2rem] border border-slate-100 bg-slate-50/75 p-6 shadow-[0_16px_48px_-40px_rgba(15,23,42,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl border ${step.accent}`}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                    d={step.iconPath}
                  />
                </svg>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {step.step}
              </span>
            </div>

            <h3 className="mt-6 font-heading text-xl font-bold text-textMain">{step.title}</h3>
            <p className="mt-3 font-body text-sm leading-7 text-slate-600">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
