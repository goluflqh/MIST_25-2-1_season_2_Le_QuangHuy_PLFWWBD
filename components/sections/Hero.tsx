"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

const slidesData = [
  {
    image: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80",
    alt: "Solar Energy",
    label: "Giải pháp năng lượng",
    caption: "Đèn năng lượng và bộ pin lưu trữ được cân theo nhu cầu dùng thật.",
  },
  {
    image: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=1200",
    alt: "Security Camera",
    label: "Camera an ninh",
    caption: "Khảo sát góc nhìn kỹ, đi dây gọn và bàn giao dễ dùng cho gia đình lẫn cửa hàng.",
  },
  {
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    alt: "Industrial Battery Pack",
    label: "Đóng pin theo yêu cầu",
    caption: "Ưu tiên cell phù hợp tải, kiểm tra nội trở và dựng mạch đúng cấu hình thiết bị.",
  },
  {
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
    alt: "Construction Worker Power Drill",
    label: "Thi công đúng tay nghề",
    caption: "Thiết bị cầm tay, loa kéo hay xe điện đều được tư vấn theo bài toán sử dụng cụ thể.",
  },
] as const;

const trustCards = [
  {
    title: "Khảo sát miễn phí",
    description: "Kiểm tra pin, camera hoặc vị trí lắp trước khi lên phương án.",
  },
  {
    title: "Báo giá công khai",
    description: "Trao đổi rõ cell, mạch, phụ kiện và công làm trước khi triển khai.",
  },
  {
    title: "Hỗ trợ trong ngày",
    description: `Tiếp nhận tư vấn trong khung giờ ${siteConfig.businessHoursLabel}.`,
  },
] as const;

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (motionQuery.matches) {
      return;
    }

    const slideInterval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slidesData.length);
    }, 4500);

    return () => window.clearInterval(slideInterval);
  }, []);

  return (
    <section className="mx-auto mt-20 flex max-w-7xl flex-col gap-8 px-4 pb-10 pt-6 sm:px-6 md:mt-28 md:py-16 lg:flex-row lg:items-center lg:gap-12 lg:px-8">
      <div className="z-10 flex flex-col items-center text-center lg:w-1/2 lg:items-start lg:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white/85 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary shadow-sm backdrop-blur sm:text-sm">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-primary">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
              />
            </svg>
          </span>
          Minh Hồng tại Đà Nẵng
        </div>

        <h1 className="mt-5 font-heading text-3xl font-extrabold leading-tight tracking-tight text-textMain sm:text-4xl md:text-5xl lg:text-6xl">
          Giải pháp thiết bị và điện máy{" "}
          <span className="bg-linear-to-r from-primary to-orange-500 bg-clip-text text-transparent">
            minh bạch, hợp nhu cầu thật
          </span>
        </h1>

        <p className="mt-5 max-w-2xl font-body text-sm leading-7 text-slate-600 sm:text-base md:text-lg">
          Minh Hồng chuyên đóng pin Lithium theo tải thực tế, phục hồi pin lưu trữ, thay pin đèn
          năng lượng và lắp đặt camera an ninh với quy trình khảo sát, báo giá, thi công và bàn
          giao rõ ràng cho từng khách.
        </p>

        <div className="mt-6 grid w-full gap-3 sm:grid-cols-3">
          {trustCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4 text-left shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] backdrop-blur"
            >
              <p className="font-heading text-base font-bold text-slate-900">{card.title}</p>
              <p className="mt-2 font-body text-sm leading-6 text-slate-600">{card.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="#quote"
            className="btn-hover-fx flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-primary to-red-700 px-6 py-3 text-sm font-bold text-white shadow-glow-primary sm:px-8 sm:py-4 sm:text-base md:text-lg"
          >
            Nhận tư vấn nhanh
          </Link>
          <a
            href={siteConfig.hotlineHref}
            className="btn-hover-fx flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-textMain shadow-sm hover:border-primary sm:px-8 sm:py-4 sm:text-base md:text-lg"
          >
            Gọi {siteConfig.hotlineDisplay}
          </a>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600">
          <Link href="#services" className="transition-colors hover:text-primary">
            Xem dịch vụ trọng tâm
          </Link>
          <Link href="/bao-gia" className="transition-colors hover:text-primary">
            Bảng giá tham khảo
          </Link>
          <span className="text-slate-300">|</span>
          <span>{siteConfig.locationLabel}</span>
        </div>
      </div>

      <div className="relative w-full lg:w-1/2">
        <div className="glass-panel relative h-[28rem] overflow-hidden rounded-[2rem] border border-white/80 p-2 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)] sm:h-[32rem]">
          <div className="relative h-full w-full overflow-hidden rounded-[1.5rem] bg-slate-100 shadow-inner">
            {slidesData.map((slide, index) => (
              <Image
                key={index}
                src={slide.image}
                alt={slide.alt}
                fill
                priority={index === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={`object-cover transition-opacity duration-1000 ease-in-out ${
                  index === currentSlide ? "z-10 opacity-100 brightness-105" : "z-0 opacity-0"
                }`}
              />
            ))}

            <div className="absolute inset-x-4 top-4 z-20 flex justify-between gap-3">
              <div className="rounded-full border border-white/20 bg-slate-950/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
                {slidesData[currentSlide].label}
              </div>
              <div className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                Khảo sát và báo giá trước khi làm
              </div>
            </div>

            <div className="absolute inset-x-4 bottom-4 z-20 rounded-[1.5rem] border border-white/15 bg-slate-950/62 p-4 text-white backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-200">
                Cam kết thi công
              </p>
              <p className="mt-2 max-w-xl font-body text-sm leading-6 text-white/90 sm:text-base">
                {slidesData[currentSlide].caption}
              </p>
            </div>

            <div className="absolute bottom-4 right-4 z-30 flex justify-center gap-2 sm:gap-3">
              {slidesData.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors sm:h-3 sm:w-3 ${
                    index === currentSlide
                      ? "bg-white shadow-glow-white"
                      : "bg-white/45 shadow-sm hover:bg-red-300"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
