import { initials } from './format';
export function CommissionAvatar({ id, name, role }: { id: string; name: string; role: string }) {
  const alternate = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2;
  const background = role === 'RESELLER' ? '#FFD000' : role === 'OWNER' ? 'var(--theme-warn, #E8A33D)' : role === 'MANAGER' ? 'var(--theme-chart-warm, #DF668B)' : role === 'NONE' ? 'var(--section)' : alternate ? 'var(--theme-chart-green, #397964)' : 'var(--theme-chart-neutral, #5B8DEF)';
  return <span className="av-c" style={{ background, color: role === 'RESELLER' ? '#17191c' : 'var(--theme-on-action, white)' }} aria-hidden="true">{role === 'NONE' ? '' : initials(name)}</span>;
}
