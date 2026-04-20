"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site";


const slidesData = [
  {
    image: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80",
    alt: "Solar Energy",
    caption: "☀️ Đèn năng lượng mặt trời cao cấp",
  },
  {
    image: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=1200",
    alt: "Security Camera",
    caption: "🎥 Lắp đặt Camera an ninh uy tín 24/7",
  },
  {
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    alt: "Industrial Battery Pack",
    caption: "🔋 Phục hồi & dựng Mạch BMS mạnh mẽ",
  },
  {
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
    alt: "Construction Worker Power Drill",
    caption: "🛠️ Sửa chữa, đóng pin dụng cụ cầm tay",
  },
];

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slidesData.length);
    }, 4500);
    return () => clearInterval(slideInterval);
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 md:py-16 flex flex-col lg:flex-row items-center gap-8 lg:gap-12 mt-20 md:mt-28">
      {/* Text Content */}
      <div className="lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-300 bg-yellow-50 text-yellow-800 font-bold text-xs sm:text-sm mb-4 md:mb-6 shadow-sm">
          ✨ Đỉnh Cao Lưu Trữ Năng Lượng & An Ninh
        </div>

        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-4 md:mb-6 leading-tight tracking-tight text-textMain">
          Giải Pháp Toàn Diện{" "}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-orange-500">
            Thiết Bị & Điện Máy
          </span>
        </h1>

        <p className="font-body text-sm sm:text-base md:text-lg text-slate-600 mb-6 md:mb-8 max-w-xl leading-relaxed">
          Chuyên đóng cell pin theo yêu cầu (xe điện, loa kéo, NLMT) sử dụng lõi chính hãng. Lắp đặt <b>Camera an ninh</b> chuyên nghiệp, khảo sát miễn phí.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="#services"
            className="btn-hover-fx bg-linear-to-r from-primary to-red-700 text-white font-body font-bold px-6 py-3 sm:px-8 sm:py-4 rounded-xl text-sm sm:text-base md:text-lg flex justify-center items-center gap-2 shadow-glow-primary"
          >
            Dịch Vụ Nổi Bật
          </Link>
          <a
            href={siteConfig.hotlineHref}
            className="btn-hover-fx bg-white text-textMain border-2 border-slate-200 hover:border-primary font-body font-bold px-6 py-3 sm:px-8 sm:py-4 rounded-xl text-sm sm:text-base md:text-lg flex justify-center items-center gap-2 shadow-sm"
          >
            📞 {siteConfig.hotlineDisplay}
          </a>
        </div>
      </div>

      {/* Image Slider */}
      <div className="lg:w-1/2 w-full relative">
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden glass-panel p-1.5 sm:p-2 h-70 sm:h-90 md:h-105 lg:h-120">
          <div className="relative w-full h-full rounded-xl sm:rounded-2xl shadow-inner overflow-hidden bg-slate-100">
            {slidesData.map((slide, index) => (
              <Image
                key={index}
                src={slide.image}
                alt={slide.alt}
                fill
                priority={index === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={`object-cover transition-opacity duration-1000 ease-in-out ${
                  index === currentSlide
                    ? "opacity-100 z-10 brightness-105"
                    : "opacity-0 z-0"
                }`}
              />
            ))}

            {/* Caption */}
            <div className="absolute bottom-10 sm:bottom-12 left-0 right-0 text-center z-20 px-4">
              <div className="inline-block bg-black/50 backdrop-blur-sm px-4 py-1.5 sm:px-6 sm:py-2 rounded-full text-white font-body text-xs sm:text-sm font-bold shadow-lg">
                {slidesData[currentSlide].caption}
              </div>
            </div>

            {/* Dots */}
            <div className="absolute bottom-3 sm:bottom-4 left-0 right-0 flex justify-center gap-2 sm:gap-3 z-30">
              {slidesData.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-colors ${
                    index === currentSlide
                      ? "bg-white shadow-glow-white"
                      : "bg-white/50 shadow-sm hover:bg-yellow-400"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                ></button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
