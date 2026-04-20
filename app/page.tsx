import Hero from "@/components/sections/Hero";
import SpecialOffer from "@/components/sections/SpecialOffer";
import Services from "@/components/sections/Services";
import Process from "@/components/sections/Process";
import Partners from "@/components/sections/Partners";
import Testimonials from "@/components/sections/Testimonials";
import ContactForm from "@/components/sections/ContactForm";
import TrustHighlights from "@/components/sections/TrustHighlights";

export default function Home() {
  return (
    <div className="pb-12">
      <Hero />
      <TrustHighlights />
      <SpecialOffer />
      <Services />
      <Process />
      <Testimonials />
      <Partners />
      <ContactForm />
    </div>
  );
}
