import { ICONS, type IconName } from './icons';

export function Icon({ name, on = false }: { name: IconName; on?: boolean }) {
  return (
    <svg
      className={on ? 'ic on' : 'ic'}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
