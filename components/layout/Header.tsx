"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function Header({
  initialNotificationCount = 0,
  initialNotificationUserId = null,
}: {
  initialNotificationCount?: number;
  initialNotificationUserId?: string | null;
}) {
  const enableBackgroundPolling = process.env.NODE_ENV === "production";
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useAuth();
  const [mobileMenuState, setMobileMenuState] = useState({ open: false, pathname });
  const [servicesMenuState, setServicesMenuState] = useState({ open: false, pathname });
  const [notifCount, setNotifCount] = useState(initialNotificationCount);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const servicesCloseTimerRef = useRef<number | null>(null);

  const isMobileMenuOpen = mobileMenuState.pathname === pathname && mobileMenuState.open;
  const isServicesOpen = servicesMenuState.pathname === pathname && servicesMenuState.open;
  const visibleUser = user;
  const visibleNotifCount = visibleUser ? notifCount : 0;
  const currentUserId = visibleUser?.id ?? null;

  useEffect(() => {
    if (currentUserId === initialNotificationUserId) {
      setNotifCount(initialNotificationCount);
    }
  }, [currentUserId, initialNotificationCount, initialNotificationUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setNotifCount(0);
      return;
    }

    let isActive = true;

    const fetchNotifs = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        const lastSeen = localStorage.getItem("mh_notif_seen") || "";
        const url = lastSeen
          ? `/api/user/notifications?lastSeen=${encodeURIComponent(lastSeen)}`
          : "/api/user/notifications";
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (!isActive) return;

        if (response.ok && data.success) {
          setNotifCount(data.total || 0);
        } else if (response.status === 401) {
          setNotifCount(0);
        }
      } catch {
        // Ignore background polling errors and keep the last count.
      }
    };

    const handleFocus = () => {
      void fetchNotifs();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifs();
      }
    };

    const hasDismissedNotifications = Boolean(localStorage.getItem("mh_notif_seen"));
    const shouldFetchImmediately =
      currentUserId !== initialNotificationUserId || hasDismissedNotifications;

    if (shouldFetchImmediately) {
      void fetchNotifs();
    }
    const interval = enableBackgroundPolling
      ? window.setInterval(() => {
          void fetchNotifs();
        }, 30000)
      : null;

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      if (interval !== null) {
        clearInterval(interval);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUserId, enableBackgroundPolling, initialNotificationUserId]);

  useEffect(() => {
    return () => {
      if (servicesCloseTimerRef.current !== null) {
        window.clearTimeout(servicesCloseTimerRef.current);
      }
    };
  }, []);

  const dismissNotifications = () => {
    localStorage.setItem("mh_notif_seen", new Date().toISOString());
    setNotifCount(0);
  };

  const clearServicesCloseTimer = () => {
    if (servicesCloseTimerRef.current !== null) {
      window.clearTimeout(servicesCloseTimerRef.current);
      servicesCloseTimerRef.current = null;
    }
  };

  const openServicesMenu = () => {
    clearServicesCloseTimer();
    setServicesMenuState({ open: true, pathname });
  };

  const scheduleServicesClose = () => {
    clearServicesCloseTimer();
    servicesCloseTimerRef.current = window.setTimeout(() => {
      setServicesMenuState({ open: false, pathname });
      servicesCloseTimerRef.current = null;
    }, 220);
  };

  const toggleServicesMenu = () => {
    clearServicesCloseTimer();
    setServicesMenuState((prev) => ({
      open: !(prev.pathname === pathname && prev.open),
      pathname,
    }));
  };

  const closeMenus = () => {
    clearServicesCloseTimer();
    setMobileMenuState({ open: false, pathname });
    setServicesMenuState({ open: false, pathname });
  };

  useEffect(() => {
    const closePublicMenu = () => {
      if (servicesCloseTimerRef.current !== null) {
        window.clearTimeout(servicesCloseTimerRef.current);
        servicesCloseTimerRef.current = null;
      }
      setMobileMenuState({ open: false, pathname });
      setServicesMenuState({ open: false, pathname });
    };

    window.addEventListener("mh:admin-menu-open", closePublicMenu);
    return () => {
      window.removeEventListener("mh:admin-menu-open", closePublicMenu);
    };
  }, [pathname]);

  const toggleMobileMenu = () => {
    const nextOpen = !isMobileMenuOpen;
    if (nextOpen) {
      window.dispatchEvent(new Event("mh:public-menu-open"));
    }
    setMobileMenuState({ open: nextOpen, pathname });
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    const previousUser = visibleUser;

    closeMenus();
    setIsLoggingOut(true);
    setNotifCount(0);
    setUser(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      startTransition(() => {
        router.replace("/");
      });
    } catch {
      setUser(previousUser);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const serviceLinks = [
    { name: "Đóng Pin Lithium", href: "/dich-vu/dong-pin" },
    { name: "Đèn Năng Lượng Mặt Trời", href: "/dich-vu/den-nang-luong" },
    { name: "Pin Lưu Trữ & Kích Đề", href: "/dich-vu/pin-luu-tru" },
    { name: "Camera An Ninh", href: "/dich-vu/camera" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
      {isMobileMenuOpen ? (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={closeMenus}
          className="fixed inset-0 z-0 cursor-default bg-transparent lg:hidden"
        />
      ) : null}
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="glass-panel flex items-center justify-between rounded-[1.6rem] border border-white/80 px-4 py-3 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] sm:px-5">
        <button
          onClick={() => {
            closeMenus();
            if (pathname === "/") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              router.push("/");
            }
          }}
          className="group flex min-w-0 shrink-0 cursor-pointer items-center gap-2.5"
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0 transition-transform duration-300 group-hover:scale-105"
          >
            <defs>
              <linearGradient id="gradRed" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="#991B1B" />
              </linearGradient>
              <linearGradient id="gradYellow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FCD34D" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <linearGradient id="gradTop" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FCA5A5" />
                <stop offset="100%" stopColor="#FDE68A" />
              </linearGradient>
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
          <div className="min-w-0">
            <span className="block font-heading text-lg font-extrabold leading-none tracking-tight text-primary sm:text-xl lg:text-2xl">
              MINH HỒNG
            </span>
            <span className="mt-0.5 block font-body text-[8px] font-bold uppercase tracking-[0.24em] text-slate-500 sm:text-[9px]">
              Điện máy - Đóng pin
            </span>
          </div>
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link
            href="/"
            className={`font-body font-semibold text-sm px-3 py-2 rounded-lg transition-colors ${isActive("/") ? "text-primary bg-red-50" : "text-slate-600 hover:text-primary hover:bg-slate-50"}`}
          >
            Trang Chủ
          </Link>

          <div
            className="relative"
            onBlur={(event) => {
              const nextFocus = event.relatedTarget;

              if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) {
                scheduleServicesClose();
              }
            }}
            onFocus={openServicesMenu}
            onMouseEnter={openServicesMenu}
            onMouseLeave={scheduleServicesClose}
          >
            <button
              type="button"
              aria-expanded={isServicesOpen}
              aria-haspopup="menu"
              onClick={toggleServicesMenu}
              className={`font-body font-semibold text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${pathname.startsWith("/dich-vu") ? "text-primary bg-red-50" : "text-slate-600 hover:text-primary hover:bg-slate-50"}`}
            >
              Dịch Vụ
              <svg
                className={`w-3.5 h-3.5 transition-transform ${isServicesOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isServicesOpen ? (
              <div className="absolute left-0 top-full w-64 pt-2">
                <div
                  role="menu"
                  className="animate-fade-in rounded-xl border border-slate-100 bg-white py-2 shadow-xl"
                >
                  {serviceLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      onClick={closeMenus}
                      className={`block px-4 py-2.5 font-body text-sm transition-colors ${isActive(link.href) ? "text-primary bg-red-50 font-bold" : "text-slate-700 hover:bg-slate-50 hover:text-primary"}`}
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <Link
            href="/bao-gia"
            className={`font-body font-semibold text-sm px-3 py-2 rounded-lg transition-colors ${isActive("/bao-gia") ? "text-primary bg-red-50" : "text-slate-600 hover:text-primary hover:bg-slate-50"}`}
          >
            Bảng Giá
          </Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
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
                  {visibleNotifCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-1 border-2 border-white animate-pulse">
                      {visibleNotifCount}
                    </span>
                  ) : null}
                </div>
                <span className="font-body font-semibold text-sm text-slate-700">{visibleUser.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="font-body text-sm text-slate-400 hover:text-red-500 disabled:text-slate-300 transition-colors px-2"
              >
                {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/dang-nhap"
                className="font-body font-semibold text-sm text-slate-600 hover:text-primary transition-colors px-3 py-2"
              >
                Đăng Nhập
              </Link>
              <Link
                href="/dang-ky"
                className="bg-gradient-to-r from-primary to-orange-600 text-white font-body font-bold text-sm px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                Đăng Ký
              </Link>
            </>
          )}
        </div>

        <button
          aria-label="Toggle Mobile Menu"
          onClick={toggleMobileMenu}
          className="rounded-full p-2 text-slate-700 transition-colors hover:bg-slate-100 hover:text-primary lg:hidden"
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

      {isMobileMenuOpen ? (
        <div className="animate-fade-in mt-2 overflow-hidden rounded-[1.4rem] border border-white/80 bg-white/95 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.45)] backdrop-blur lg:hidden">
          <nav className="px-4 py-4 space-y-1">
            <Link
              href="/"
              onClick={closeMenus}
              className={`block px-4 py-3 rounded-xl font-body font-semibold text-sm ${isActive("/") ? "text-primary bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}
            >
              Trang Chủ
            </Link>

            <p className="px-4 pt-3 pb-1 font-body text-xs font-bold text-slate-400 uppercase tracking-wider">
              Dịch vụ
            </p>
            {serviceLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenus}
                className={`block px-4 py-3 rounded-xl font-body font-semibold text-sm ${isActive(link.href) ? "text-primary bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {link.name}
              </Link>
            ))}

            <Link
              href="/bao-gia"
              onClick={closeMenus}
              className={`block px-4 py-3 rounded-xl font-body font-semibold text-sm ${isActive("/bao-gia") ? "text-primary bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}
            >
              Bảng Giá
            </Link>

            <div className="h-px bg-slate-100 mx-4 my-2"></div>

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
                    {visibleNotifCount > 0 ? (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-1 border-2 border-white animate-pulse">
                        {visibleNotifCount}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="font-body font-bold text-sm text-slate-900">{visibleUser.name}</p>
                    <p className="font-body text-xs text-slate-400">
                      {visibleUser.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left px-4 py-3 rounded-xl font-body font-semibold text-sm text-red-500 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  {isLoggingOut ? "Đang đăng xuất..." : "Đăng Xuất"}
                </button>
              </>
            ) : (
              <div className="px-4 pt-2 space-y-2">
                <Link
                  href="/dang-nhap"
                  onClick={closeMenus}
                  className="block w-full text-center py-3 rounded-xl font-body font-bold text-sm text-slate-700 border border-slate-200 hover:bg-slate-50"
                >
                  Đăng Nhập
                </Link>
                <Link
                  href="/dang-ky"
                  onClick={closeMenus}
                  className="block w-full text-center py-3 rounded-xl font-body font-bold text-sm text-white bg-gradient-to-r from-primary to-orange-600 shadow-md"
                >
                  Đăng Ký Miễn Phí
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
      </div>
    </header>
  );
}
