import { useEffect, useState, type ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import { listInvitations, type Invitation } from '../../services/invitations-api';
import { listMembers, type TeamMember } from '../../services/members-api';
import { MemberPermissions } from './MemberPermissions';
import { contactSummary } from '../../lib/store-contact';
import { formatArDate, initials, relTime } from '../format';
import { unreadBySection, type NoticeSection } from '../unread-count';
import { ImanagerIcon, notificationIcon } from '../icons';
import { ChipRow, DeskIcon, PageHead, useDesk } from '../ui';

const SECTION_LABEL: Record<NoticeSection, string> = {
  inventory: 'Inventario',
  sales: 'Ventas',
  tradeins: 'Canjes',
  clients: 'Clientes',
};

export function NotificationsScreen() {
  const { operationNotifications, notificationsLoading, notificationsError, refreshNotifications, markNotificationRead, markAllNotificationsRead } = useAppContext();
  const { go, toast, openRecord } = useDesk();
  const [filter, setFilter] = useState('Todas');
  const unread = unreadBySection(operationNotifications);
  const visible = operationNotifications.filter((note) => {
    if (filter === 'unread') return !note.readAt;
    if (filter === 'Todas') return true;
    return note.section === filter;
  });

  const mark = async (id: string, section: string, recordId: string | null | undefined, kind: string) => {
    try {
      const note = operationNotifications.find((item) => item.id === id);
      if (note && !note.readAt) await markNotificationRead(id);
      if (recordId) openRecord(section, recordId, kind);
      else if (['inventory', 'sales', 'tradeins', 'clients'].includes(section)) go(section as 'inventory' | 'sales' | 'tradeins' | 'clients');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo abrir la notificaci\u00f3n.');
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      toast('Todo le\u00eddo');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudieron marcar como le\u00eddas.');
    }
  };

  return (
    <div className="dscreen">
      <PageHead
        title="Notificaciones"
        subtitle={unread.total ? `Total: ${unread.total} sin leer` : 'Todo al d\u00eda'}
        action={<div style={{ display: 'flex', gap: 14 }}>{unread.total > 0 ? <button className="wlink" type="button" disabled={notificationsLoading} onClick={() => void markAll()}>Leer todas</button> : null}<button className="wlink" type="button" disabled={notificationsLoading} onClick={() => void refreshNotifications().catch(() => undefined)}>Actualizar</button></div>}
      />
      <div style={{ padding: '0 20px 12px', maxWidth: 860 }}>
        <ChipRow options={[
          { id: 'Todas', label: 'Todas' },
          ...Object.entries(SECTION_LABEL).map(([id, label]) => ({ id, label: `${label} ${unread.bySection[id as NoticeSection]}` })),
          { id: 'unread', label: 'Sin leer' },
        ]} value={filter} onChange={setFilter} />
      </div>
      {notificationsError ? <div className="wempty" role="alert" style={{ maxWidth: 860 }}>{notificationsError}</div> : null}
      {notificationsLoading && operationNotifications.length === 0 ? <div className="wempty" style={{ maxWidth: 860 }}>Cargando notificaciones...</div> : null}
      {!notificationsLoading && visible.length === 0 ? <div className="wempty" style={{ maxWidth: 860 }}>{emptyCopy(filter)}</div> : (
        <div className="card" style={{ maxWidth: 860 }}>
          {visible.map((note) => {
            const seen = !!note.readAt;
            return (
              <button key={note.id} className="member" type="button" onClick={() => void mark(note.id, note.section, note.recordId, note.kind)}>
                <div className={'ico-row' + (seen ? '' : ' l')}><ImanagerIcon name={notificationIcon(note)} size={20} active={!seen} /></div>
                <div className="info"><div className="name">{note.title}</div><div className="role">{note.message} {'\u00b7'} {relTime(note.createdAt)} {'\u00b7'} {sectionLabel(note.section)}</div></div>
                {seen ? <span className="chev">&rsaquo;</span> : <span className="unread" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function useUnreadCounts() {
  const { operationNotifications } = useAppContext();
  return unreadBySection(operationNotifications);
}

export function useUnreadCount() {
  return useUnreadCounts().total;
}

function sectionLabel(section: string) {
  return SECTION_LABEL[section as NoticeSection] ?? section;
}

function emptyCopy(filter: string) {
  if (filter === 'Todas') return 'Todav\u00eda no hay notificaciones.';
  if (filter === 'unread') return 'Est\u00e1s al d\u00eda. No hay notificaciones sin leer.';
  return `No hay notificaciones de ${sectionLabel(filter)}.`;
}

const ROLE_LABEL: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Socio', STAFF: 'Empleado' };

function MRow({ icon, title, sub, right, onClick }: { icon: ReactNode; title: string; sub: string; right?: string; onClick?: () => void }) {
  return (
    <button className="member" type="button" onClick={onClick}>
      <div className="ico-row">{icon}</div>
      <div className="info"><div className="name">{title}</div><div className="role">{sub}</div></div>
      {right ? <span className="rtxt">{right}</span> : null}
      <span className="chev">›</span>
    </button>
  );
}

export function SettingsScreen() {
  const { appSession, user } = useAppContext();
  const { open, isStaff, toast } = useDesk();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const load = () => {
    if (!user || !appSession?.store?.id) return;
    listMembers(user, appSession.store.id).then(setMembers).catch(() => setMembers([]));
    if (!isStaff) listInvitations(user).then(setInvites).catch(() => setInvites([]));
  };

  useEffect(() => { load(); }, [user, appSession?.store?.id, isStaff]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener('desk-invites', refresh);
    return () => window.removeEventListener('desk-invites', refresh);
  }, [user, appSession?.store?.id, isStaff]);

  const me = appSession?.user;
  const store = appSession?.store;
  const inviteLine = invites.map((invite) => `${ROLE_LABEL[invite.role] ?? invite.role} · expira ${formatArDate(new Date(invite.expiresAt))}`).join(' · ');

  if (selected) {
    return (
      <MemberPermissions
        member={selected}
        onBack={() => setSelected(null)}
        onSaved={(member) => setMembers((current) => current.map((item) => item.id === member.id ? { ...item, ...member } : item))}
      />
    );
  }

  return (
    <div className="dscreen">
      <PageHead title="Configuración" subtitle="Tienda, equipo y tu cuenta" />
      <div className="settings-grid">
        {!isStaff && (
          <>
            <div className="sec">Tienda</div>
            <div className="card">
              <MRow icon={<DeskIcon name="store" size={18} />} title={store?.name || 'Tienda'} sub={contactSummary(store)} onClick={() => open({ type: 'store' })} />
            </div>
            <div className="sec"><span>Equipo</span><span className="secr">{members.length} miembros</span></div>
            <div className="card">
              {members.map((member, index) => (
                <button className="member" type="button" key={member.id} onClick={() => setSelected(member)}>
                  <div className={`av-c ${['b', 'p', 'g'][index % 3]}`}>{initials(member.user.displayName || member.user.email || 'U')}</div>
                  <div className="info">
                    <div className="name">{member.user.displayName || member.user.email}</div>
                    <div className="role">{member.user.email}</div>
                  </div>
                  {member.userId === me?.id ? <span className="spill mid">vos</span> : null}
                  <span className={`spill ${member.role === 'OWNER' ? 'off' : 'mid'}`}>{ROLE_LABEL[member.role] ?? member.role}</span>
                  <span className="chev">›</span>
                </button>
              ))}
              {invites.length > 0 ? (
                <button className="member" type="button" onClick={() => open({ type: 'invites' })}>
                  <div className="info">
                    <div className="name">{invites.length === 1 ? '1 link de invitación activo' : `${invites.length} links de invitación activos`}</div>
                    <div className="role">{inviteLine}</div>
                  </div>
                  <span className="chev">›</span>
                </button>
              ) : null}
              <button className="invite" type="button" onClick={() => open({ type: 'invite' })}>+ Invitar al equipo</button>
            </div>
          </>
        )}
        <div className="sec">Mi cuenta</div>
        <div className="card">
          <MRow icon={<ImanagerIcon name="cliente" size={20} />} title="Perfil" sub={`${me?.displayName || 'Usuario'} · ${me?.email || ''}`} onClick={() => open({ type: 'profile' })} />
          <MRow icon={<DeskIcon name="lock" size={18} />} title="Seguridad" sub="Cambiar contraseña" onClick={() => open({ type: 'password' })} />
          <MRow icon={<DeskIcon name="card" size={18} />} title="Facturación" sub="Usuario Beta" right="Acceso anticipado" onClick={() => toast('Estás en el acceso anticipado.')} />
        </div>
        <div className="logout"><button type="button" onClick={() => open({ type: 'logout' })}>Cerrar sesión</button></div>
      </div>
    </div>
  );
}
