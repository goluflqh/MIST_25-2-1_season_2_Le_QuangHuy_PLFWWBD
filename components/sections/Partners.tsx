const partnerLogos = [
  <div key="samsung" className="flex shrink-0 items-center text-3xl font-black tracking-tighter text-blue-700 md:text-4xl">
    SAMSUNG <span className="ml-1 rounded bg-blue-700 px-1.5 py-0.5 font-sans text-xs font-bold text-white">SDI</span>
  </div>,
  <div key="lg" className="flex shrink-0 items-center text-4xl font-black tracking-tight text-red-600 md:text-5xl">
    LG <span className="ml-1 font-body text-2xl font-normal italic text-slate-700">Chem</span>
  </div>,
  <div key="panasonic" className="shrink-0 text-3xl font-black tracking-widest text-blue-600 md:text-4xl">
    Panasonic
  </div>,
  <div key="makita" className="shrink-0 text-3xl font-black italic tracking-wider text-teal-600 md:text-4xl">
    Makita
  </div>,
  <div key="dewalt" className="shrink-0 select-none font-serif text-3xl font-black tracking-tighter text-yellow-500 drop-shadow-sm md:text-4xl">
    DEWALT
  </div>,
];

export default function Partners() {
  return (
    <section className="mx-auto mb-16 max-w-7xl overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <p className="flex items-center justify-center gap-3 font-body text-sm font-semibold text-slate-500">
          <span className="h-px w-12 bg-slate-200" /> Đối tác & Công nghệ thiết bị chính hãng <span className="h-px w-12 bg-slate-200" />
        </p>
      </div>

      <div className="mask-image-fade group relative flex overflow-hidden">
        {[0, 1].map((loop) => (
          <div
            key={loop}
            aria-hidden={loop === 1}
            className="flex min-w-max animate-marquee items-center gap-14 whitespace-nowrap py-4 pr-14 transition-transform duration-300 group-hover:[animation-play-state:paused] md:gap-24 md:pr-24"
          >
            {partnerLogos}
          </div>
        ))}
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
