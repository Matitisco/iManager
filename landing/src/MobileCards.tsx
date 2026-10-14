import { useEffect, useRef, useState } from 'react';
import { FEATURES } from './content';
import { Icon } from './Icon';

/** Tarjetas deslizables con las funciones (mobile; con «reducir movimiento» también en desktop). */
export function MobileCards() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const track = trackRef.current!;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const card = track.firstElementChild as HTMLElement | null;
        const step = card ? card.offsetWidth + 12 : 304;
        const max = track.scrollWidth - track.clientWidth;
        const k = track.scrollLeft >= max - 4 ? FEATURES.length - 1 : Math.round(track.scrollLeft / step);
        setIdx(Math.max(0, Math.min(FEATURES.length - 1, k)));
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const go = (i: number) => {
    const track = trackRef.current!;
    const card = track.children[i] as HTMLElement | undefined;
    if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft - 20, behavior: 'smooth' });
  };

  return (
    <section className="mcards" id="mcards" aria-label="Funciones, pieza por pieza">
      <div className="k">Cada pieza, una función<span className="swipe"> · deslizá →</span></div>
      <div className="track" ref={trackRef}>
        {FEATURES.map((f) => (
          <article className="mc" key={f.k}>
            <div className="top">
              <span className="ico"><Icon name={f.icon} on /></span>
              <div>
                <small>{f.capa.split(' · ')[0]}</small>
                <h4>{f.title}</h4>
              </div>
            </div>
            <p>{f.text}</p>
            <img src={`/assets/${f.img}`} alt="" loading="lazy" decoding="async" width="780" height="1688" />
          </article>
        ))}
      </div>
      <div className="dots">
        {FEATURES.map((f, i) => (
          <button type="button" key={f.k} className={i === idx ? 'on' : undefined} aria-label={`Ver ${f.title}`} onClick={() => go(i)} />
        ))}
      </div>
    </section>
  );
}
