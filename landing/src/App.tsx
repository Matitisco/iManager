import { NotFound } from './Legal';
import { Nav } from './Nav';
import { Beta, FinalCta, Footer, Hero, HowToStart, Problem, Solution } from './Sections';
import { normalizePath } from './paths';

export function App({ path }: { path?: string }) {
  const pathname = normalizePath(path ?? (typeof window === 'undefined' ? '/' : window.location.pathname));
  const home = pathname === '/';
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="hero">
        <Nav path={pathname} />
        {home && <Hero />}
      </header>
      <main id="contenido">
        {home ? <><Problem /><Solution /><HowToStart /><Beta /><FinalCta /></> : (
          <section className="legal-page"><div className="wrap"><NotFound /></div></section>
        )}
      </main>
      <Footer />
    </>
  );
}
