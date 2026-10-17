import { Hero } from './hero/Hero';
import { NotFound } from './Legal';
import { Nav } from './Nav';
import { Faq, Features, FinalCta, Footer, HowItWorks, Pricing, Problem, Screens } from './Sections';
import { normalizePath } from './paths';

export function App({ path }: { path?: string }) {
  const pathname = normalizePath(path ?? (typeof window === 'undefined' ? '/' : window.location.pathname));
  const page = pathname === '/' ? 'home' : '404';
  return (
    <>
      <Nav path={pathname} />
      <main>
        {page === 'home' && (
          <>
            <Hero />
            <Problem />
            <Features />
            <HowItWorks />
            <Screens />
            <Pricing />
            <Faq />
            <FinalCta />
          </>
        )}
        {page === '404' && <section className="sec legal-page"><div className="wrap"><NotFound /></div></section>}
      </main>
      <Footer path={pathname} />
    </>
  );
}
