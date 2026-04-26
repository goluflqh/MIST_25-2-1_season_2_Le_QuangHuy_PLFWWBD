"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

const slidesData = [
  {
    alt: "Bàn kỹ thuật đóng pin Lithium với cell, mạch BMS và pin máy công cụ.",
    caption: "Đo cell, BMS và tải trước khi làm.",
    href: "/dich-vu/dong-pin",
    image: "/showcase/generated/hero-battery-workbench-v2.webp",
    label: "Đóng pin theo tải",
  },
  {
    alt: "Camera an ninh Wi-Fi ngoài trời lắp tại mặt tiền cửa hàng.",
    caption: "Chọn góc, đi dây gọn, xem từ xa.",
    href: "/dich-vu/camera",
    image: "/showcase/generated/hero-camera-install-v2.webp",
    label: "Camera an ninh",
  },
  {
    alt: "Đèn pha năng lượng mặt trời và tấm pin lắp ở cổng nhà.",
    caption: "Tính vị trí, giờ sáng và pin thay thế.",
    href: "/dich-vu/den-nang-luong",
    image: "/showcase/generated/hero-solar-install-v2.webp",
    label: "Đèn năng lượng",
  },
  {
    alt: "Bộ pin lưu trữ và kích đề được sắp xếp trên quầy kỹ thuật.",
    caption: "Tính tải xả, thời gian dùng và độ an toàn.",
    href: "/dich-vu/pin-luu-tru",
    image: "/showcase/generated/hero-storage-counter-v2.webp",
    label: "Pin lưu trữ",
  },
] as const;

const quickTrust = [
  {
    description: "Xem thiết bị hoặc vị trí lắp trước khi lên phương án.",
    iconPath:
      "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    title: "Khảo sát trước",
  },
  {
    description: "Nói rõ cell, mạch, công lắp và chi phí trước khi làm.",
    iconPath:
      "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Báo giá rõ",
  },
  {
    description: `Tiếp nhận và phản hồi trong khung giờ ${siteConfig.businessHoursLabel}.`,
    iconPath:
      "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Hỗ trợ trong ngày",
  },
] as const;

const serviceShortcuts = [
  { href: "/dich-vu/dong-pin", label: "Đóng pin Lithium" },
  { href: "/dich-vu/den-nang-luong", label: "Đèn NLMT" },
  { href: "/dich-vu/pin-luu-tru", label: "Pin lưu trữ" },
  { href: "/dich-vu/camera", label: "Camera an ninh" },
] as const;

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const swipeStartXRef = useRef<number | null>(null);

  const goToSlide = useCallback((slideIndex: number) => {
    setCurrentSlide((slideIndex + slidesData.length) % slidesData.length);
  }, []);

  const goToNextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slidesData.length);
  }, []);

  const goToPreviousSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slidesData.length) % slidesData.length);
  }, []);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (motionQuery.matches) {
      return;
    }

    const slideInterval = window.setInterval(() => {
      goToNextSlide();
    }, 5200);

    return () => window.clearInterval(slideInterval);
  }, [goToNextSlide]);

  const handleSwipeStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") {
      return;
    }

    swipeStartXRef.current = event.clientX;
  };

  const handleSwipeEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || swipeStartXRef.current === null) {
      return;
    }

    const swipeDistance = event.clientX - swipeStartXRef.current;
    swipeStartXRef.current = null;

    if (Math.abs(swipeDistance) < 48) {
      return;
    }

    if (swipeDistance < 0) {
      goToNextSlide();
    } else {
      goToPreviousSlide();
    }
  };

  const activeSlide = slidesData[currentSlide];

  return (
    <section className="mx-auto mt-2 flex max-w-7xl flex-col gap-5 px-4 pb-7 pt-2 sm:px-6 lg:flex-row lg:items-center lg:gap-12 lg:px-8 lg:pb-10 lg:pt-8">
      <div className="z-10 flex flex-col items-start text-left lg:w-[min(100%,36rem)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white/90 px-3 py-1.5 text-sm font-semibold text-primary shadow-sm backdrop-blur">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-primary">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
          Tư vấn rõ trước khi làm
        </div>

        <h1 className="mt-4 max-w-3xl text-pretty font-heading text-[1.95rem] font-extrabold leading-[1.06] tracking-tight text-textMain sm:text-[2.85rem] md:text-[3.35rem]">
          Đóng pin, camera và giải pháp điện máy{" "}
          <span className="bg-linear-to-r from-primary to-orange-500 bg-clip-text text-transparent">
            rõ cấu hình, gọn lắp đặt
          </span>
          .
        </h1>

        <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-slate-600 sm:text-base sm:leading-7 md:text-lg">
          Minh Hồng nhận khảo sát, báo giá và thi công cho đóng pin Lithium, pin lưu trữ,
          đèn năng lượng mặt trời và camera an ninh với cách làm gọn, minh bạch và dễ
          theo dõi trên điện thoại.
        </p>

        <div className="mt-5 grid w-full grid-cols-2 gap-3 sm:w-auto sm:flex">
          <Link
            href="#quote"
            className="btn-hover-fx inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.5)] transition-colors hover:bg-primary sm:px-8 sm:text-base"
          >
            Nhận tư vấn
          </Link>
          <a
            href={siteConfig.hotlineHref}
            className="btn-hover-fx inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-textMain shadow-sm transition-colors hover:border-primary hover:text-primary sm:px-8 sm:text-base"
          >
            Gọi ngay
          </a>
        </div>

        <div className="mt-5 hidden w-full gap-3 sm:grid sm:grid-cols-3">
          {quickTrust.map((card) => (
            <div
              key={card.title}
              className="rounded-[1.25rem] border border-white/80 bg-white/90 p-3.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)] backdrop-blur"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-primary">
                <svg className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d={card.iconPath}
                  />
                </svg>
              </div>
              <p className="mt-3 font-body text-sm font-semibold text-slate-900">{card.title}</p>
              <p className="mt-1 font-body text-xs leading-5 text-slate-600">{card.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
          {serviceShortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="rounded-full border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary"
            >
              {shortcut.label}
            </Link>
          ))}
        </div>

        <div className="mt-4 hidden flex-wrap items-center gap-4 text-sm font-semibold text-slate-600 sm:flex">
          <Link href="/bao-gia" className="transition-colors hover:text-primary">
            Xem bảng giá tham khảo
          </Link>
          <span className="text-slate-300">|</span>
          <span>{siteConfig.locationLabel}</span>
        </div>
      </div>

      <div className="relative w-full lg:flex-1">
        <div className="glass-panel relative overflow-hidden rounded-[1.75rem] border border-white/90 p-1.5 shadow-[0_30px_90px_-46px_rgba(15,23,42,0.45)] sm:rounded-[2.25rem] sm:p-2">
          <div
            className="relative h-[16.5rem] touch-pan-y overflow-hidden rounded-[1.35rem] bg-slate-100 sm:h-[24rem] sm:rounded-[1.7rem] lg:h-[28rem]"
            onPointerCancel={() => {
              swipeStartXRef.current = null;
            }}
            onPointerDown={handleSwipeStart}
            onPointerUp={handleSwipeEnd}
          >
            {slidesData.map((slide, index) => (
              <Image
                key={slide.label}
                src={slide.image}
                alt={slide.alt}
                fill
                loading={index === currentSlide ? "eager" : "lazy"}
                unoptimized
                sizes="(max-width: 1024px) 100vw, 48vw"
                className={`object-cover transition-opacity duration-700 ease-out ${
                  index === currentSlide ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}

            <button
              type="button"
              onClick={goToPreviousSlide}
              className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-slate-950/45 text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-white/80 sm:inline-flex"
              aria-label="Xem ảnh trước"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goToNextSlide}
              className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-slate-950/45 text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-white/80 sm:inline-flex"
              aria-label="Xem ảnh tiếp theo"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4 sm:gap-3">
              <div className="rounded-full border border-white/20 bg-slate-950/72 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.18em]">
                {activeSlide.label}
              </div>
              <Link
                href={activeSlide.href}
                className="inline-flex items-center rounded-full border border-white/20 bg-white/14 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/24 sm:px-3.5 sm:py-2 sm:text-[11px]"
              >
                Xem dịch vụ
              </Link>
            </div>

            <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/15 bg-slate-950/58 px-3 py-2 text-white shadow-[0_16px_44px_-30px_rgba(15,23,42,0.8)] backdrop-blur sm:inset-x-4 sm:bottom-4 sm:px-4 sm:py-3">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[11px] font-semibold leading-4 text-white/92 sm:text-sm sm:leading-5">
                    {activeSlide.caption}
                  </p>
                  <span className="mt-1 block text-[10px] font-semibold text-white/62 sm:hidden">
                    {currentSlide + 1}/{slidesData.length}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <span className="hidden text-xs font-semibold text-white/70 sm:inline">
                    {currentSlide + 1}/{slidesData.length}
                  </span>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {slidesData.map((slide, index) => (
                      <button
                        key={slide.label}
                        onClick={() => goToSlide(index)}
                        className={`h-2 w-4 rounded-full transition-colors sm:h-2.5 sm:w-2.5 ${
                          index === currentSlide ? "bg-white" : "bg-white/38 hover:bg-red-200"
                        }`}
                        aria-label={`Chuyển tới ảnh ${index + 1}`}
                        aria-pressed={index === currentSlide}
                        type="button"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
