import Hero from "@/components/sections/Hero";
import SpecialOffer from "@/components/sections/SpecialOffer";
import Services from "@/components/sections/Services";
import Process from "@/components/sections/Process";
import Partners from "@/components/sections/Partners";
import Testimonials from "@/components/sections/Testimonials";
import ContactForm from "@/components/sections/ContactForm";

export default function Home() {
  return (
    <div className="pb-12">
      <Hero />
      <SpecialOffer />
      <Services />
      <Process />
      <Partners />
      <Testimonials />
      <ContactForm />
    </div>
  );
}
