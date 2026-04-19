"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface NavCounts { contacts: number; reviews: number; }

const navItems = [
  { href: "/dashboard", label: "Tổng Quan", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  { href: "/dashboard/contacts", label: "Yêu Cầu Tư Vấn", icon: "M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8", countKey: "contacts" as const },
  { href: "/dashboard/users", label: "Khách Hàng", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/dashboard/reviews", label: "Đánh Giá", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z", countKey: "reviews" as const },
  { href: "/dashboard/pricing", label: "Bảng Giá", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/dashboard/warranty", label: "Bảo Hành", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
];

function SidebarNav({ pathname, counts }: { pathname: string; counts: NavCounts }) {
  return (
    <>
      <div className="p-6 border-b border-slate-700">
        <h2 className="font-heading font-bold text-lg text-yellow-400">🔧 Admin Panel</h2>
        <p className="text-xs text-slate-400 font-body mt-1">Minh Hồng Dashboard</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const count = item.countKey ? counts[item.countKey] : 0;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-body font-semibold transition-colors relative ${isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
              {item.label}
              {count > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-black rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 animate-pulse">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-700 space-y-2">
        <Link href="/tai-khoan" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors font-body">
          👤 Tài Khoản
        </Link>
        <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors font-body">
          ← Về Trang Chủ
        </Link>
      </div>
    </>
  );
}

export default function AdminSidebar({ initialCounts }: { initialCounts: NavCounts }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<NavCounts>(initialCounts);
  const [mobileMenuState, setMobileMenuState] = useState({ open: false, pathname });
  const mobileOpen = mobileMenuState.pathname === pathname && mobileMenuState.open;

  useEffect(() => {
    let isActive = true;

    const fetchCounts = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        const response = await fetch("/api/admin/notifications", { cache: "no-store" });
        const data = await response.json();
        if (isActive && data.success) {
          setCounts(data.counts);
        }
      } catch {
        // Ignore background polling errors and keep the last known counts.
      }
    };

    const handleFocus = () => {
      void fetchCounts();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchCounts();
      }
    };

    const interval = window.setInterval(() => {
      void fetchCounts();
    }, 30000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuState((prev) => ({
      open: !(prev.pathname === pathname && prev.open),
      pathname,
    }));
  };

  const closeMobileMenu = () => {
    setMobileMenuState({ open: false, pathname });
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"
        aria-label="Toggle admin menu"
      >
        {mobileOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        )}
      </button>

      {/* Mobile overlay + sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={closeMobileMenu} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 text-white flex flex-col animate-fade-in">
            <SidebarNav pathname={pathname} counts={counts} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col shrink-0">
        <SidebarNav pathname={pathname} counts={counts} />
      </aside>
    </>
  );
}
