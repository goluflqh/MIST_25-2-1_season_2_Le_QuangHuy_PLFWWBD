"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface UserInfo {
  name: string;
  role: string;
}

function hasSessionCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith("session_token="));
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuState, setMobileMenuState] = useState({ open: false, pathname });
  const [servicesMenuState, setServicesMenuState] = useState({ open: false, pathname });
  const [user, setUser] = useState<UserInfo | null>(null);
  const [notifCount, setNotifCount] = useState(0);
  const hasSession = hasSessionCookie();

  const isMobileMenuOpen = mobileMenuState.pathname === pathname && mobileMenuState.open;
  const isServicesOpen = servicesMenuState.pathname === pathname && servicesMenuState.open;
  const visibleUser = hasSession ? user : null;
  const visibleNotifCount = hasSession ? notifCount : 0;

  // Only call auth/me when a session cookie exists to avoid noisy 401s on public pages.
  useEffect(() => {
    if (!hasSession) return;

    let isMounted = true;

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success) setUser(data.user);
        else {
          setUser(null);
          setNotifCount(0);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
        setNotifCount(0);
      });

    return () => {
      isMounted = false;
    };
  }, [hasSession, pathname]);

  // Fetch notification count
  useEffect(() => {
    if (!hasSession || !user) return;
    const fetchNotifs = () => {
      const lastSeen = localStorage.getItem("mh_notif_seen") || "";
      const url = lastSeen ? `/api/user/notifications?lastSeen=${encodeURIComponent(lastSeen)}` : "/api/user/notifications";
      fetch(url)
        .then((r) => r.json())
        .then((d) => { if (d.success) setNotifCount(d.total || 0); })
        .catch(() => {});
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [hasSession, user, pathname]);

  const dismissNotifications = () => {
    localStorage.setItem("mh_notif_seen", new Date().toISOString());
    setNotifCount(0);
  };

  const closeMenus = () => {
    setMobileMenuState({ open: false, pathname });
    setServicesMenuState({ open: false, pathname });
  };

  const toggleMobileMenu = () => {
    setMobileMenuState((prev) => ({
      open: !(prev.pathname === pathname && prev.open),
      pathname,
    }));
  };

  const handleLogout = async () => {
    closeMenus();
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setNotifCount(0);
    router.push("/");
  };

  const serviceLinks = [
    { name: "🔋 Đóng Pin Lithium", href: "/dich-vu/dong-pin" },
    { name: "☀️ Đèn Năng Lượng Mặt Trời", href: "/dich-vu/den-nang-luong" },
    { name: "⚡ Pin Lưu Trữ & Kích Đề", href: "/dich-vu/pin-luu-tru" },
    { name: "📹 Camera An Ninh", href: "/dich-vu/camera" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => {
            closeMenus();
            if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
            else router.push("/");
          }}
          className="flex items-center gap-2.5 group shrink-0 cursor-pointer"
        >
          <svg width="40" height="40" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="transform transition-transform group-hover:scale-105 duration-300">
            <defs>
              <linearGradient id="gradRed" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#991B1B" /></linearGradient>
              <linearGradient id="gradYellow" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#FCD34D" /><stop offset="100%" stopColor="#B45309" /></linearGradient>
              <linearGradient id="gradTop" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#FCA5A5" /><stop offset="100%" stopColor="#FDE68A" /></linearGradient>
            </defs>
            <g>
              <path d="M100 20 L169 60 L100 100 L31 60 Z" fill="url(#gradTop)" />
              <path d="M31 60 L45 68 L45 148 L31 140 Z" fill="url(#gradRed)" />
              <path d="M58 76 L72 84 L72 164 L58 156 Z" fill="url(#gradRed)" />
              <path d="M86 92 L100 100 L100 180 L86 172 Z" fill="url(#gradRed)" />
              <path d="M100 100 L118 89.6 L118 169.6 L100 180 Z" fill="url(#gradYellow)" />
              <path d="M151 70.4 L169 60 L169 140 L151 150.4 Z" fill="url(#gradYellow)" />
              <path d="M118 114.6 L151 95.4 L151 115.4 L118 134.6 Z" fill="url(#gradYellow)" />
            </g>
          </svg>
          <div className="flex flex-col">
            <span className="font-heading font-extrabold text-xl lg:text-2xl tracking-tight text-primary leading-none">MINH HỒNG</span>
            <span className="font-body text-[9px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Điện Máy - Đóng Pin</span>
          </div>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link href="/" className={`font-body font-semibold text-sm px-3 py-2 rounded-lg transition-colors ${isActive("/") ? "text-primary bg-red-50" : "text-slate-600 hover:text-primary hover:bg-slate-50"}`}>
            Trang Chủ
          </Link>

          {/* Services Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setServicesMenuState({ open: true, pathname })}
            onMouseLeave={() => setServicesMenuState({ open: false, pathname })}
          >
            <button className={`font-body font-semibold text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${pathname.startsWith("/dich-vu") ? "text-primary bg-red-50" : "text-slate-600 hover:text-primary hover:bg-slate-50"}`}>
              Dịch Vụ
              <svg className={`w-3.5 h-3.5 transition-transform ${isServicesOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isServicesOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-fade-in">
                {serviceLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={`block px-4 py-2.5 font-body text-sm transition-colors ${isActive(link.href) ? "text-primary bg-red-50 font-bold" : "text-slate-700 hover:bg-slate-50 hover:text-primary"}`}>
                    {link.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/bao-gia" className={`font-body font-semibold text-sm px-3 py-2 rounded-lg transition-colors ${isActive("/bao-gia") ? "text-primary bg-red-50" : "text-slate-600 hover:text-primary hover:bg-slate-50"}`}>
            Bảng Giá
          </Link>
        </nav>

        {/* Desktop Auth / User */}
        <div className="hidden lg:flex items-center gap-3">
          {visibleUser ? (
            <>
              <Link
                href={visibleUser.role === "ADMIN" ? "/dashboard" : "/tai-khoan"}
                onClick={() => {
                  dismissNotifications();
                  closeMenus();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                    {visibleUser.name.charAt(0)}
                  </div>
                  {visibleNotifCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-1 border-2 border-white animate-pulse">
                      {visibleNotifCount}
                    </span>
                  )}
                </div>
                <span className="font-body font-semibold text-sm text-slate-700">{visibleUser.name}</span>
              </Link>
              <button onClick={handleLogout} className="font-body text-sm text-slate-400 hover:text-red-500 transition-colors px-2">
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link href="/dang-nhap" className="font-body font-semibold text-sm text-slate-600 hover:text-primary transition-colors px-3 py-2">
                Đăng Nhập
              </Link>
              <Link href="/dang-ky" className="bg-gradient-to-r from-primary to-orange-600 text-white font-body font-bold text-sm px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all">
                Đăng Ký
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          aria-label="Toggle Mobile Menu"
          onClick={toggleMobileMenu}
          className="lg:hidden text-slate-700 hover:text-primary p-2 -mr-2"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 shadow-xl animate-fade-in">
          <nav className="px-4 py-4 space-y-1">
            <Link href="/" onClick={closeMenus} className={`block px-4 py-3 rounded-xl font-body font-semibold text-sm ${isActive("/") ? "text-primary bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}>
              🏠 Trang Chủ
            </Link>

            {/* Mobile Service Links */}
            <p className="px-4 pt-3 pb-1 font-body text-xs font-bold text-slate-400 uppercase tracking-wider">Dịch vụ</p>
            {serviceLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={closeMenus} className={`block px-4 py-3 rounded-xl font-body font-semibold text-sm ${isActive(link.href) ? "text-primary bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}>
                {link.name}
              </Link>
            ))}

            <Link href="/bao-gia" onClick={closeMenus} className={`block px-4 py-3 rounded-xl font-body font-semibold text-sm ${isActive("/bao-gia") ? "text-primary bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}>
              💰 Bảng Giá
            </Link>

            {/* Divider */}
            <div className="h-px bg-slate-100 mx-4 my-2"></div>

            {/* Auth / User */}
            {visibleUser ? (
              <>
                <Link
                  href={visibleUser.role === "ADMIN" ? "/dashboard" : "/tai-khoan"}
                  onClick={() => {
                    dismissNotifications();
                    closeMenus();
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50"
                >
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
                      {visibleUser.name.charAt(0)}
                    </div>
                    {visibleNotifCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-1 border-2 border-white animate-pulse">
                        {visibleNotifCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-body font-bold text-sm text-slate-900">{visibleUser.name}</p>
                    <p className="font-body text-xs text-slate-400">{visibleUser.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}</p>
                  </div>
                </Link>
                <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-xl font-body font-semibold text-sm text-red-500 hover:bg-red-50">
                  🚪 Đăng Xuất
                </button>
              </>
            ) : (
              <div className="px-4 pt-2 space-y-2">
                <Link href="/dang-nhap" onClick={closeMenus} className="block w-full text-center py-3 rounded-xl font-body font-bold text-sm text-slate-700 border border-slate-200 hover:bg-slate-50">
                  Đăng Nhập
                </Link>
                <Link href="/dang-ky" onClick={closeMenus} className="block w-full text-center py-3 rounded-xl font-body font-bold text-sm text-white bg-gradient-to-r from-primary to-orange-600 shadow-md">
                  Đăng Ký Miễn Phí
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
