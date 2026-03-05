import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-heading font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="font-heading font-bold text-2xl text-slate-900 mb-2">
          Không tìm thấy trang
        </h1>
        <p className="font-body text-slate-500 mb-8">
          Trang bạn đang tìm không tồn tại hoặc đã bị di chuyển.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/"
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl font-body font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
            🏠 Về Trang Chủ
          </Link>
          <Link href="/bao-gia"
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-body font-bold text-sm hover:bg-slate-50 transition-colors">
            💰 Xem Bảng Giá
          </Link>
        </div>
      </div>
    </div>
  );
}
