import { Hero } from './hero/Hero';
import { MobileCards } from './MobileCards';
import { Nav } from './Nav';
import { Faq, Features, FinalCta, Footer, HowItWorks, Pricing, Problem, Screens, Testimonials } from './Sections';

export function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <MobileCards />
        <Problem />
        <Features />
        <HowItWorks />
        <Screens />
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
