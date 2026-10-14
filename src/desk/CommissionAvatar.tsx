import { initials } from './format';
export function CommissionAvatar({ id, name, role }: { id: string; name: string; role: string }) {
  const alternate = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2;
  const background = role === 'OWNER' ? '#E8A33D' : role === 'MANAGER' ? '#DF668B' : role === 'NONE' ? '#9AA0AA' : alternate ? '#397964' : '#5B8DEF';
  return <span className="av-c" style={{ background, color: 'white' }} aria-hidden="true">{role === 'NONE' ? '' : initials(name)}</span>;
}
