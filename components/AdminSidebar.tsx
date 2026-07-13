"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

interface NavCounts { contacts: number; reviews: number; }

const navItems = [
  { href: "/dashboard", label: "Tổng Quan", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  { href: "/dashboard/contacts", label: "Yêu Cầu Tư Vấn", icon: "M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8", countKey: "contacts" as const },
  { href: "/dashboard/orders", label: "Đơn Dịch Vụ", icon: "M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zm2 4h6" },
  { href: "/dashboard/partners", label: "Sổ Đối Tác", icon: "M17 9V7a5 5 0 00-10 0v2m-2 0h14l1 11H4L5 9zm4 4h6" },
  { href: "/dashboard/users", label: "Khách Hàng", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/dashboard/reviews", label: "Đánh Giá", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z", countKey: "reviews" as const },
  { href: "/dashboard/pricing", label: "Bảng Giá", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/dashboard/warranty", label: "Bảo Hành", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
];

function SidebarNav({
  pathname,
  counts,
  onNavigate,
  titleId,
  onClose,
}: {
  pathname: string;
  counts: NavCounts;
  onNavigate?: () => void;
  titleId?: string;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="relative border-b border-slate-700 p-6 pr-16">
        <h2 id={titleId} className="font-heading font-bold text-lg text-yellow-400">🔧 Admin Panel</h2>
        <p className="text-xs text-slate-400 font-body mt-1">Minh Hồng Dashboard</p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            data-admin-menu-close
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            aria-label="Đóng menu quản trị"
          >
            <svg className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        ) : null}
      </div>
      <nav aria-label="Điều hướng quản trị" className="flex-1 overflow-y-auto p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const count = item.countKey ? counts[item.countKey] : 0;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-body font-semibold transition-colors relative ${isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
              {item.label}
              {count > 0 && (
                <span aria-label={`${count} mục mới`} className="ml-auto bg-red-500 text-white text-[10px] font-black rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 animate-pulse">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-700 space-y-2">
        <Link href="/tai-khoan" onClick={onNavigate} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white font-body">
          👤 Tài Khoản
        </Link>
        <Link href="/" onClick={onNavigate} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white font-body">
          ← Về Trang Chủ
        </Link>
      </div>
    </>
  );
}

function MobileAdminToolbar({
  adminName,
  mobileOpen,
  onToggle,
  buttonRef,
  controlsId,
}: {
  adminName?: string;
  mobileOpen: boolean;
  onToggle: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  controlsId: string;
}) {
  return (
    <div className="z-[45] flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-expanded={mobileOpen}
        aria-controls={controlsId}
        className="admin-menu-toggle flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm shadow-slate-900/20 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
        aria-label={mobileOpen ? "Đóng menu quản trị" : "Mở menu quản trị"}
        title="Menu admin"
      >
        {mobileOpen ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-base font-extrabold text-slate-900">Bảng Điều Khiển</h1>
        {adminName ? (
          <p className="truncate font-body text-xs font-semibold text-slate-500">Admin: {adminName}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminSidebar({
  adminName,
  children,
  initialCounts,
}: {
  adminName?: string;
  children?: ReactNode;
  initialCounts: NavCounts;
}) {
  const enableBackgroundPolling = process.env.NODE_ENV === "production";
  const pathname = usePathname();
  const [counts, setCounts] = useState<NavCounts>(initialCounts);
  const [mobileMenuState, setMobileMenuState] = useState({ open: false, pathname });
  const mobileDialogRef = useRef<HTMLElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuId = "mobile-admin-menu";
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

    const interval = enableBackgroundPolling
      ? window.setInterval(() => {
          void fetchCounts();
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
  }, [enableBackgroundPolling]);

  const toggleMobileMenu = () => {
    const nextOpen = !mobileOpen;
    if (nextOpen) {
      window.dispatchEvent(new Event("mh:admin-menu-open"));
    }
    setMobileMenuState({ open: nextOpen, pathname });
  };

  const closeMobileMenu = useCallback(() => {
    setMobileMenuState({ open: false, pathname });
  }, [pathname]);

  useEffect(() => {
    const closeAdminMenu = () => {
      setMobileMenuState({ open: false, pathname });
    };

    window.addEventListener("mh:public-menu-open", closeAdminMenu);
    return () => {
      window.removeEventListener("mh:public-menu-open", closeAdminMenu);
    };
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const toggleButton = mobileToggleRef.current;
    document.body.style.overflow = "hidden";
    mobileDialogRef.current?.querySelector<HTMLElement>("[data-admin-menu-close]")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileMenu();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = mobileDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      toggleButton?.focus();
    };
  }, [closeMobileMenu, mobileOpen]);

  return (
    <div
      data-admin-shell
      className="relative flex h-[calc(100dvh-var(--app-header-offset))] min-h-0 overflow-hidden md:h-auto md:min-h-[calc(100dvh-var(--app-header-offset))] md:overflow-visible"
    >
      {/* Mobile overlay + sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" onMouseDown={closeMobileMenu} />
          <aside
            ref={mobileDialogRef}
            id={mobileMenuId}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-admin-menu-title"
            className="absolute bottom-0 left-0 top-0 flex w-64 max-w-[85vw] flex-col overflow-hidden bg-slate-900 text-white shadow-2xl animate-fade-in"
          >
            <SidebarNav
              pathname={pathname}
              counts={counts}
              onNavigate={closeMobileMenu}
              onClose={closeMobileMenu}
              titleId="mobile-admin-menu-title"
            />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col shrink-0">
        <SidebarNav pathname={pathname} counts={counts} />
      </aside>

      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden bg-slate-50">
        <MobileAdminToolbar
          adminName={adminName}
          mobileOpen={mobileOpen}
          onToggle={toggleMobileMenu}
          buttonRef={mobileToggleRef}
          controlsId={mobileMenuId}
        />
        <header className="hidden items-center justify-between border-b border-slate-200 bg-white px-6 py-4 md:flex">
          <h1 className="font-heading text-xl font-bold text-slate-900">Bảng Điều Khiển</h1>
          {adminName ? (
            <span className="font-body text-sm text-slate-500">Admin: {adminName}</span>
          ) : null}
        </header>
        <div data-admin-scroll className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6 md:overflow-visible">
          <div className="min-w-0 max-w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}
