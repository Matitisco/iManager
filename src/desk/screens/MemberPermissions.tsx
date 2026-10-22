import { isSectionHidden } from '../../config/hiddenSections';
import { toActionMessage } from '../../lib/user-message';
import { Fragment, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { removeMember, updateMemberSections, type TeamMember } from '../../services/members-api';
import { DESK_SECTIONS, grantedSections } from '../sections';
import { canEditMember, PERMISSION_PROFILES, permissionProfile } from '../team-permissions';
import { usePhoneLayout } from '../section-notices';
import { Actions, BackButton, DeskIcon, PageHead } from '../ui';
import { initials } from '../format';
import './team.css';

const ORDER = ['inventory', 'publicCatalog', 'sales', 'tradeins', 'clients', 'service', 'cash', 'reports', 'commissions', 'dashboard', 'notifications'] as const;
const ICONS = { inventory: 'list', publicCatalog: 'store', sales: 'cart', tradeins: 'swap', clients: 'user', service: 'wrench', cash: 'card', reports: 'bars', commissions: 'comisiones', dashboard: 'grid', notifications: 'bell' } as const;

export function MemberPermissions({ member, onBack, onSaved, onRemoved, draft = false }: {
  member: TeamMember;
  onBack: () => void;
  onSaved: (member: TeamMember) => void;
  onRemoved?: () => void;
  draft?: boolean;
}) {
  const { user, appSession, reloadSession } = useAppContext();
  const phone = usePhoneLayout();
  const locked = member.role === 'OWNER' || (!draft && !canEditMember(appSession?.membership?.role, appSession?.user.id, member));
  const [sections, setSections] = useState<string[]>(() => [...grantedSections(member.sections, member.role), ...(member.sections?.includes('cashBalances') ? ['cashBalances'] : []), ...(member.sections?.includes('history') ? ['history'] : [])]);
  const [sensitive, setSensitive] = useState(() => member.sensitiveAccess ?? (member.role === 'MANAGER' || member.role === 'OWNER'));
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const name = member.user.displayName || member.user.email || 'Miembro';
  const profile = permissionProfile(sections);

  const toggle = (id: string) => {
    if (locked) return;
    setSections(current => current.includes(id) ? current.filter(item => item !== id && !(id === 'cash' && item === 'cashBalances')) : [...current, id]);
  };
  const save = async () => {
    if (locked) return;
    if (draft) { onSaved({ ...member, sections, sensitiveAccess: sensitive }); onBack(); return; }
    if (!user || !appSession?.store?.id) return;
    setBusy(true); setError('');
    try {
      const saved = await updateMemberSections(user, appSession.store.id, member.id, sections, sensitive);
      if (member.userId === appSession.user.id) await reloadSession();
      onSaved(saved); onBack();
    } catch (err) { setError(toActionMessage(err, 'No se pudieron guardar los permisos')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (locked || draft || !user || !appSession?.store?.id) return;
    setBusy(true); setError('');
    try { await removeMember(user, appSession.store.id, member.id); onRemoved?.(); onBack(); }
    catch (err) { setError(toActionMessage(err, 'No se pudo quitar a la persona del equipo')); }
    finally { setBusy(false); }
  };
  const saveBar = locked ? null : <Actions primary={phone ? 'Guardar' : 'Guardar permisos'} onPrimary={() => { void save(); }} onSecondary={onBack} busy={busy} />;
  const row = (id: typeof ORDER[number]) => {
    if (isSectionHidden(id)) return null;
    const label = DESK_SECTIONS.find(s => s.id === id)!.label;
    const on = sections.includes(id);
    return <Fragment key={id}><div className={`perm team-perm${on ? '' : ' muted'}`}>
      <span className="team-perm-icon"><DeskIcon name={ICONS[id]} size={19} /></span>
      <div><b>{label}</b>{id === 'publicCatalog' ? <small>Elegir qué equipos se publican, precios y orden</small> : id === 'commissions' ? <small>Sin esto ve solo «Mis comisiones»</small> : <span className="sr-only">{on ? 'Puede ver esta sección' : 'Sin acceso'}</span>}</div>
      <button type="button" className={`sw${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={locked || busy} onClick={() => toggle(id)}><i /></button>
    </div>{id === 'cash' ? <div className="perm team-perm team-nested"><div><b>Ver saldo de cajas</b></div><button type="button" className={`sw${sections.includes('cashBalances') ? ' on' : ''}`} role="switch" aria-label="Ver saldo de cajas" aria-checked={sections.includes('cash') && sections.includes('cashBalances')} disabled={locked || busy || !sections.includes('cash')} onClick={() => toggle('cashBalances')}><i /></button></div> : null}{id === 'reports' ? <div className={`perm team-perm${sections.includes('history') ? '' : ' muted'}`}><span className="team-perm-icon"><DeskIcon name="clock" size={19} /></span><div><b>Ver historial</b><small>Quién hizo qué y cuándo, en toda la tienda</small></div><button type="button" className={`sw${sections.includes('history') ? ' on' : ''}`} role="switch" aria-checked={sections.includes('history')} aria-label="Ver historial" disabled={locked || busy} onClick={() => toggle('history')}><i /></button></div> : null}</Fragment>;
  };
  return <div className={`dscreen team-permissions${phone && saveBar ? ' has-save' : ''}`}>
    {phone ? <BackButton onClick={onBack} /> : <button type="button" className="team-back" onClick={onBack}>‹ Equipo</button>}
    <div className="team-member-head"><div className="av-c">{initials(name)}</div><PageHead title={name} action={phone ? undefined : saveBar} /></div>
    <div className="team-profiles" role="group" aria-label="Perfiles rápidos">{[...Object.keys(PERMISSION_PROFILES), 'Personalizado'].map(label => <button type="button" key={label} className={`gchip${profile === label ? ' on' : ''}`} aria-pressed={profile === label} disabled={locked || busy || label === 'Personalizado'} onClick={() => setSections([...PERMISSION_PROFILES[label as keyof typeof PERMISSION_PROFILES]])}>{label}</button>)}</div>
    <div className="team-perm-columns"><div className="card">{ORDER.slice(0, 6).map(row)}</div><div className="card">{ORDER.slice(6).map(row)}</div></div>
    <div className="card team-sensitive"><div className="perm team-perm"><span className="team-perm-icon"><DeskIcon name="lock" size={19} /></span><div><b>Acciones sensibles</b><small>Anular, borrar, cambiar precio o costo</small></div><button type="button" className={`sw${sensitive ? ' on' : ''}`} role="switch" aria-checked={sensitive} aria-label="Acciones sensibles" disabled={locked || busy} onClick={() => setSensitive(current => !current)}><i /></button></div></div>
    {locked ? <p className="perm-note">{member.role === 'OWNER' ? 'El propietario conserva el acceso a todas las secciones.' : 'Solo el propietario puede editar estos permisos.'}</p> : null}
    {!draft && !locked ? <button type="button" className="team-remove" disabled={busy} onClick={() => { setError(''); setConfirmRemove(true); }}>Quitar del equipo</button> : null}
    {error ? <div className="ferr" role="alert">{error}</div> : null}
    {confirmRemove ? <div className="ov center"><div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-member-title"><h2 id="remove-member-title">¿Quitar a {name} del equipo?</h2><p>Va a perder el acceso a la tienda.</p><Actions primary="Quitar del equipo" secondary="Volver" danger busy={busy} onPrimary={() => { void remove(); }} onSecondary={() => setConfirmRemove(false)} />{error ? <p role="alert" className="ferr">{error}</p> : null}</div></div> : null}
    {phone && saveBar ? <div className="phone-save" data-testid="permissions-save">{saveBar}</div> : null}
  </div>;
}
