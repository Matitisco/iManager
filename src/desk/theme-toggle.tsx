import { Moon, Sun } from 'lucide-react';
import { setThemePreference, useResolvedTheme, useThemePreference } from '../lib/theme';

export function ThemeToggle() {
  const preference = useThemePreference();
  const resolved = useResolvedTheme();
  const active = preference === 'auto' ? resolved : preference;
  return (
    <div className="thm" role="group" aria-label="Tema">
      {([['light', 'Tema claro', Sun], ['dark', 'Tema oscuro', Moon]] as const).map(([value, label, Icon]) => (
        <button key={value} type="button" className={active === value ? 'on' : undefined} aria-label={label} aria-pressed={active === value} onClick={() => setThemePreference(value)}>
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
