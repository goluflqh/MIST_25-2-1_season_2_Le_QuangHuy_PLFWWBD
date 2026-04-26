export default function Partners() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-16 overflow-hidden">
      <div className="text-center mb-10">
        <p className="flex items-center justify-center gap-3 font-body text-sm font-semibold text-slate-500">
          <span className="w-12 h-px bg-slate-200"></span> Đối tác & Công nghệ
          thiết bị chính hãng <span className="w-12 h-px bg-slate-200"></span>
        </p>
      </div>

      <div className="relative flex overflow-hidden group mask-image-fade">
        <div className="flex items-center gap-16 whitespace-nowrap py-4 pr-16 transition-transform duration-300 md:animate-marquee md:gap-24 md:pr-24 md:group-hover:[animation-play-state:paused]">
          <div className="text-3xl md:text-4xl font-black font-heading tracking-tighter text-blue-700 flex items-center shrink-0">
            SAMSUNG{" "}
            <span className="text-xs ml-1 font-sans text-white font-bold bg-blue-700 px-1.5 py-0.5 rounded">
              SDI
            </span>
          </div>
          <div className="text-4xl md:text-5xl font-black font-heading tracking-tight text-red-600 flex items-center shrink-0">
            LG{" "}
            <span className="font-normal font-body italic text-2xl ml-1 text-slate-700">
              Chem
            </span>
          </div>
          <div className="text-3xl md:text-4xl font-black font-heading tracking-widest text-blue-600 shrink-0">
            Panasonic
          </div>
          <div className="text-3xl md:text-4xl font-black font-heading tracking-wider text-teal-600 italic shrink-0">
            Makita
          </div>
          <div className="text-3xl md:text-4xl font-black font-heading tracking-tighter font-serif text-yellow-500 shrink-0 select-none drop-shadow-sm">
            DEWALT
          </div>
        </div>

        {/* Duplicate for seamless scroll */}
        <div
          className="absolute top-0 hidden items-center gap-24 whitespace-nowrap py-4 pr-24 transition-transform duration-300 md:flex md:animate-marquee md:group-hover:[animation-play-state:paused]"
          aria-hidden="true"
        >
          <div className="text-3xl md:text-4xl font-black font-heading tracking-tighter text-blue-700 flex items-center shrink-0">
            SAMSUNG{" "}
            <span className="text-xs ml-1 font-sans text-white font-bold bg-blue-700 px-1.5 py-0.5 rounded">
              SDI
            </span>
          </div>
          <div className="text-4xl md:text-5xl font-black font-heading tracking-tight text-red-600 flex items-center shrink-0">
            LG{" "}
            <span className="font-normal font-body italic text-2xl ml-1 text-slate-700">
              Chem
            </span>
          </div>
          <div className="text-3xl md:text-4xl font-black font-heading tracking-widest text-blue-600 shrink-0">
            Panasonic
          </div>
          <div className="text-3xl md:text-4xl font-black font-heading tracking-wider text-teal-600 italic shrink-0">
            Makita
          </div>
          <div className="text-3xl md:text-4xl font-black font-heading tracking-tighter font-serif text-yellow-500 shrink-0 select-none drop-shadow-sm">
            DEWALT
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .mask-image-fade { 
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); 
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); 
        }
      `}} />
    </section>
  );
}
