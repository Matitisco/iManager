import { setThemePreference, useThemePreference } from '../lib/theme';

export function ThemeSelector() {
  const preference = useThemePreference();
  return (
    <div className="theme-preference">
      <span id="theme-label" className="name">Tema de este dispositivo</span>
      <div className="sgs" role="group" aria-labelledby="theme-label">
        {([['light', 'Claro'], ['dark', 'Oscuro'], ['auto', 'Automático']] as const).map(([value, label]) => (
          <button key={value} type="button" className={`sg${preference === value ? ' on' : ''}`} aria-pressed={preference === value} onClick={() => setThemePreference(value)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
