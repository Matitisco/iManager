export function AccessoryMark({ category }: { category: string }) {
  const name = category.toLowerCase();
  const cable = name.includes('cable');
  const charger = !cable && name.includes('carg');
  const cover = name.includes('funda');
  const glass = name.includes('templ');
  return (
    <span className="athumb" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {cable ? <path d="M7 4v5a5 5 0 0 0 5 5h5M17 14v6" /> : null}
        {charger ? <path d="M8 8h8v9H8zM10 8V4M14 8V4M10 21v-4M14 21v-4" /> : null}
        {cover ? <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></> : null}
        {glass ? <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /> : null}
        {!cable && !charger && !cover && !glass ? <path d="M5 8h14v11H5zM8 8V5h8v3" /> : null}
      </svg>
    </span>
  );
}
