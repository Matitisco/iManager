import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { updateMemberSections, type TeamMember } from '../../services/members-api';
import { DESK_SECTIONS, visibleSections } from '../sections';
import { usePhoneLayout } from '../section-notices';
import { Actions, PageHead } from '../ui';

const ROLE_LABEL: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Socio', STAFF: 'Empleado' };

export function MemberPermissions({ member, onBack, onSaved }: {
  member: TeamMember;
  onBack: () => void;
  onSaved: (member: TeamMember) => void;
}) {
  const { user, appSession, reloadSession } = useAppContext();
  const phone = usePhoneLayout();
  const locked = member.role === 'OWNER';
  const [sections, setSections] = useState(() => visibleSections(member.sections, member.role));
  const [sensitive, setSensitive] = useState(() => member.sensitiveAccess ?? (member.role === 'MANAGER' || member.role === 'OWNER'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = member.user.displayName || member.user.email || 'Miembro';

  const toggle = (id: string) => {
    if (locked) return;
    setSections((current) => current.includes(id as typeof current[number]) ? current.filter((item) => item !== id) : [...current, id as typeof current[number]]);
  };

  const save = async () => {
    if (!user || !appSession?.store?.id || locked) return;
    setBusy(true);
    setError('');
    try {
      const saved = await updateMemberSections(user, appSession.store.id, member.id, sections, sensitive);
      if (member.userId === appSession.user.id) await reloadSession();
      onSaved(saved);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los permisos');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dscreen">
      <PageHead
        title="Permisos"
        subtitle={`${name} · ${member.user.email || 'Sin email'} · ${ROLE_LABEL[member.role] ?? member.role}`}
        back={phone ? onBack : undefined}
        action={phone ? undefined : <button className="dbtn s" type="button" onClick={onBack}>Volver</button>}
      />
      <div className="settings-grid">
        <div className="sec">Secciones</div>
        <div className="card">
          {DESK_SECTIONS.map((section) => {
            const on = sections.includes(section.id);
            return (
              <div className="perm" key={section.id}>
                <div>
                  <b>{section.label}</b>
                  <small>{on ? 'Puede ver esta sección' : 'Sin acceso'}</small>
                </div>
                <button
                  type="button"
                  className={`sw${on ? ' on' : ''}`}
                  role="switch"
                  aria-checked={on}
                  aria-label={section.label}
                  disabled={locked || busy}
                  onClick={() => toggle(section.id)}
                >
                  <i />
                </button>
              </div>
            );
          })}
        </div>
        <div className="sec">Acciones</div>
        <div className="card">
          <div className="perm">
            <div>
              <b>Acciones sensibles</b>
              <small>{sensitive ? 'Puede cancelar, borrar y cambiar precio o costo' : 'Sin permiso'}</small>
            </div>
            <button
              type="button"
              className={`sw${sensitive ? ' on' : ''}`}
              role="switch"
              aria-checked={sensitive || locked}
              aria-label="Acciones sensibles"
              disabled={locked || busy}
              onClick={() => setSensitive((current) => !current)}
            >
              <i />
            </button>
          </div>
        </div>
        {locked ? <p className="perm-note">El propietario conserva el acceso a todas las secciones.</p> : null}
        {error ? <div className="ferr">{error}</div> : null}
        {locked ? null : <Actions primary="Guardar permisos" onPrimary={() => { void save(); }} onSecondary={onBack} busy={busy} />}
      </div>
    </div>
  );
}
