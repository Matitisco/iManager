import { track } from '../../lib/analytics';
import { billingAccountSubtitle } from './BillingScreen';
import { NETWORK_ERROR_MESSAGE, toUserMessage } from '../../lib/user-message';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import { listInvitations, revokeInvitation, type Invitation } from '../../services/invitations-api';
import { listMembers, type TeamMember } from '../../services/members-api';
import { MemberPermissions } from './MemberPermissions';
import { contactSummary } from '../../lib/store-contact';
import { formatArDate, initials, parseAppDate, relTime } from '../format';
import { usePhoneLayout } from '../section-notices';
import { unreadBySection, type NoticeSection } from '../unread-count';
import { ImanagerIcon, notificationIcon } from '../icons';
import { configHash, configPlace, writeHash } from '../hash-route';
import { BackButton, ChipRow, DeskIcon, PageHead, SearchBox, useDesk } from '../ui';
import { ROLE_LABEL } from '../../lib/roles';
import { Link2, MessageCircle, X } from 'lucide-react';
import { canEditMember } from '../team-permissions';
import './team.css';
import { canViewTeam } from '../sections';
import { suppressLocalNetworkBanner, useOfflineBannerOwned } from '../offline-banner';

const SECTION_LABEL: Record<NoticeSection, string> = {
  inventory: 'Inventario',
  sales: 'Ventas',
  tradeins: 'Canjes',
  clients: 'Clientes',
};

const NOTICE_GROUPS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'antes', label: 'Anteriores' },
] as const;

type NoticeGroupId = (typeof NOTICE_GROUPS)[number]['id'];

export function noticeBucket(createdAt: string, now = new Date()): NoticeGroupId {
  const date = parseAppDate(createdAt);
  if (!date) return 'antes';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff <= 0) return 'hoy';
  if (diff < 7) return 'semana';
  return 'antes';
}

export function NotificationsScreen() {
  const { operationNotifications, notificationsLoading, notificationsError, refreshNotifications, markNotificationRead, markAllNotificationsRead } = useAppContext();
  const { go, toast, openRecord, back } = useDesk();
  const phone = usePhoneLayout();
  const offlineOwned = useOfflineBannerOwned();
  const [filter, setFilter] = useState('Todas');
  const [scope, setScope] = useState<'all' | 'unread'>('all');
  const [section, setSection] = useState('Todas');
  const [query, setQuery] = useState('');
  const unread = unreadBySection(operationNotifications);
  const needle = query.trim().toLowerCase();
  const visible = operationNotifications.filter((note) => {
    if (!phone) {
      if (filter === 'unread') return !note.readAt;
      if (filter === 'Todas') return true;
      return note.section === filter;
    }
    if (scope === 'unread' && note.readAt) return false;
    if (section !== 'Todas' && note.section !== section) return false;
    if (!needle) return true;
    return `${note.title} ${note.message} ${sectionLabel(note.section)}`.toLowerCase().includes(needle);
  });
  const grouped = NOTICE_GROUPS.map((group) => ({
    ...group,
    notes: visible
      .filter((note) => noticeBucket(note.createdAt) === group.id)
      .sort((left, right) => (parseAppDate(right.createdAt)?.getTime() ?? 0) - (parseAppDate(left.createdAt)?.getTime() ?? 0)),
  })).filter((group) => group.notes.length > 0);

  const mark = async (id: string, section: string, recordId: string | null | undefined, kind: string) => {
    try {
      const note = operationNotifications.find((item) => item.id === id);
      if (note && !note.readAt) await markNotificationRead(id);
      if (recordId) openRecord(section, recordId, kind);
      else if (['inventory', 'sales', 'tradeins', 'clients'].includes(section)) go(section as 'inventory' | 'sales' | 'tradeins' | 'clients');
    } catch (error) {
      toast(toUserMessage(error, 'No se pudo abrir la notificaci\u00f3n.'));
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      toast('Todo le\u00eddo');
    } catch (error) {
      toast(toUserMessage(error, 'No se pudieron marcar como le\u00eddas.'));
    }
  };

  const sectionChips = [
    { id: 'Todas', label: 'Todas' },
    ...Object.entries(SECTION_LABEL).map(([id, label]) => ({ id, label: `${label} ${unread.bySection[id as NoticeSection]}` })),
  ];

  if (!phone) {
    return (
      <div className="dscreen">
        <PageHead
          title="Notificaciones"
          subtitle={unread.total ? `Total: ${unread.total} sin leer` : 'Todo al d\u00eda'}
          back={back}
          action={<div style={{ display: 'flex', gap: 14 }}>{unread.total > 0 ? <button className="wlink" type="button" disabled={notificationsLoading} onClick={() => void markAll()}>Leer todas</button> : null}<button className="wlink" type="button" disabled={notificationsLoading} onClick={() => void refreshNotifications().catch(() => undefined)}>Actualizar</button></div>}
        />
        <div style={{ padding: '0 20px 12px', maxWidth: 860 }}>
          <ChipRow options={[
            ...sectionChips,
            { id: 'unread', label: 'Sin leer' },
          ]} value={filter} onChange={setFilter} />
        </div>
        {notificationsError && !suppressLocalNetworkBanner(notificationsError, offlineOwned) ? <div className="wempty" role="alert" style={{ maxWidth: 860 }} data-testid={notificationsError === NETWORK_ERROR_MESSAGE ? 'offline-banner' : undefined}>{notificationsError}</div> : null}
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

  const quietEmpty = !needle && section === 'Todas' && scope === 'all' && operationNotifications.length === 0;

  return (
    <div className="dscreen notif-screen" data-testid="notifications-screen">
      <div className="whead">
        {back ? <BackButton onClick={back} /> : null}
        <div className="whead-copy"><h1>Notificaciones</h1></div>
      </div>
      <div className="notif-tools">
        <span className="notif-count">{unread.total ? `${unread.total} sin leer` : 'Estás al día'}</span>
        <span className="notif-acts">
          {unread.total > 0 ? (
            <button className="wlink" type="button" disabled={notificationsLoading} onClick={() => void markAll()}>
              <CheckIcon />
              Marcar todas como leídas
            </button>
          ) : null}
          <button className="wlink" type="button" disabled={notificationsLoading} onClick={() => void refreshNotifications().catch(() => undefined)}>Actualizar</button>
        </span>
      </div>
      <div className="notif-seg" role="group" aria-label="Lectura" data-testid="notifications-read-filter">
        <button type="button" className={scope === 'all' ? 'on' : ''} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Todas</button>
        <button type="button" className={scope === 'unread' ? 'on' : ''} aria-pressed={scope === 'unread'} onClick={() => setScope('unread')}>
          Sin leer
          {unread.total > 0 ? <span className="dcount" aria-hidden="true">{unread.total}</span> : null}
        </button>
      </div>
      <div className="msearch">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar notificaciones" />
      </div>
      <div className="notif-sections" data-testid="notifications-sections">
        <ChipRow options={sectionChips} value={section} onChange={setSection} />
      </div>
      {notificationsError && !suppressLocalNetworkBanner(notificationsError, offlineOwned) ? <div className="wempty" role="alert" data-testid={notificationsError === NETWORK_ERROR_MESSAGE ? 'offline-banner' : undefined}>{notificationsError}</div> : null}
      {notificationsLoading && operationNotifications.length === 0 ? <div className="wempty">Cargando notificaciones...</div> : visible.length === 0 ? (
        quietEmpty ? <NotificationsEmpty /> : <div className="wempty">{phoneEmptyCopy({ query, section, scope })}</div>
      ) : (
        <div className="notif-groups" data-testid="notification-groups">
          {grouped.map((group) => (
            <section key={group.id} data-testid={`notification-group-${group.id}`}>
              <div className="notif-gh">{group.label}</div>
              <div className="card">
                {group.notes.map((note) => {
                  const seen = !!note.readAt;
                  return (
                    <button key={note.id} className="member notif-row" type="button" data-testid={`notification-${note.id}`} onClick={() => void mark(note.id, note.section, note.recordId, note.kind)}>
                      <div className={'ico-row' + (seen ? '' : ' l')}><ImanagerIcon name={notificationIcon(note)} size={20} active={!seen} /></div>
                      <div className="info">
                        <div className="notif-line">
                          <div className="name">{note.title}</div>
                          <span className="notif-when">{relTime(note.createdAt)}</span>
                        </div>
                        <div className="role">{note.message}</div>
                        <span className="notif-sec">{sectionLabel(note.section)}</span>
                      </div>
                      {seen ? null : <span className="unread" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7.5" />
    </svg>
  );
}

function NotificationsEmpty() {
  return (
    <div className="inv-empty notif-empty" data-testid="notifications-empty">
      <div className="inv-empty-box">
        <div className="notif-bell"><DeskIcon name="bell" size={22} /></div>
        <b>No hay notificaciones</b>
        <p>Todavía no tenés notificaciones en tu historial.</p>
      </div>
    </div>
  );
}

function phoneEmptyCopy({ query, section, scope }: { query: string; section: string; scope: 'all' | 'unread' }) {
  if (query.trim()) return 'No hay notificaciones con esa búsqueda.';
  if (section !== 'Todas') return `No hay notificaciones de ${sectionLabel(section)}.`;
  if (scope === 'unread') return 'Estás al día. No hay notificaciones sin leer.';
  return 'Todavía no hay notificaciones.';
}

export function useUnreadCounts() {
  const { operationNotifications } = useAppContext();
  return unreadBySection(operationNotifications);
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sectionLabel(section: string) {
  return SECTION_LABEL[section as NoticeSection] ?? section;
}

function emptyCopy(filter: string) {
  if (filter === 'Todas') return 'Todav\u00eda no hay notificaciones.';
  if (filter === 'unread') return 'Est\u00e1s al d\u00eda. No hay notificaciones sin leer.';
  return `No hay notificaciones de ${sectionLabel(filter)}.`;
}


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
  const { open, isStaff, toast, back, go } = useDesk();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [place, setPlace] = useState(() => configPlace(window.location.hash));
  const [teamError, setTeamError] = useState('');
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const phone = usePhoneLayout();
  const seeTeam = canViewTeam(appSession?.membership?.role);
  useEffect(() => {
    const sync = () => setPlace(configPlace(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const loadVersion = useRef(0);
  const load = useCallback(() => {
    const version = ++loadVersion.current;
    if (!user || !appSession?.store?.id || !seeTeam) return;
    setTeamError('');
    void Promise.all([listMembers(user, appSession.store.id), listInvitations(user)])
      .then(([nextMembers, nextInvites]) => {
        if (version !== loadVersion.current) return;
        setMembers(nextMembers); setMembersLoaded(true); setInvites(nextInvites);
      })
      .catch(err => { if (version === loadVersion.current) setTeamError(toUserMessage(err, 'No se pudo cargar el equipo')); });
  }, [user, appSession?.store?.id, seeTeam]);

  useEffect(() => {
    setMembers([]); setMembersLoaded(false); setInvites([]); load();
    return () => { loadVersion.current += 1; };
  }, [load]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener('desk-invites', refresh);
    return () => window.removeEventListener('desk-invites', refresh);
  }, [load]);

  const me = appSession?.user;
  const store = appSession?.store;
  const copyLink = async (link: string) => {
    try { await navigator.clipboard.writeText(link); track('invite_shared', { channel: 'copy' }); toast('Link copiado'); }
    catch { setTeamError('No se pudo copiar el link. Intentá de nuevo.'); }
  };
  const openMember = (id: string) => {
    const onTeam = configPlace(window.location.hash).page === 'team' && !configPlace(window.location.hash).memberId;
    sessionStorage.setItem('team-parent', onTeam ? configHash('team') : configHash('settings'));
    writeHash(configHash('team', id));
  };
  const closeMember = () => writeHash(sessionStorage.getItem('team-parent') || configHash('settings'), 'replace');
  const revoke = (id: string) => {
    if (!user) return;
    setBusyInvite(id); setTeamError('');
    void revokeInvitation(user, id).then(() => { setInvites(current => current.filter(item => item.id !== id)); setRevokeId(null); toast('Invitación cancelada'); }).catch(err => setTeamError(toUserMessage(err, 'No se pudo cancelar la invitación'))).finally(() => setBusyInvite(null));
  };
  const teamContent = <>
    {teamError ? <p className="ferr" role="alert">{teamError}</p> : null}
    <div className="team-grid" data-testid="settings-team">
      <div className="sec"><span>Equipo</span><span className="secr" data-testid="settings-member-count">{membersLoaded ? countLabel(members.length, 'miembro', 'miembros') : '…'}</span></div>
      <div className="card team-card">
        {members.map((member, index) => {
          const editable = canEditMember(appSession?.membership?.role, me?.id, member);
          const label = member.user.displayName || member.user.email || 'Miembro';
          return <button className="member" type="button" key={member.id} data-testid={`settings-member-${member.id}`} disabled={!editable} onClick={() => openMember(member.id)}>
            <div className={`av-c ${['b', 'p', 'g'][index % 3]}`}>{initials(label)}</div>
            <div className="info"><div className="name">{label}</div><div className="role">{member.user.email || 'Sin email'}</div></div>
            {member.userId === me?.id ? <span className="you-badge">vos</span> : null}
            <span className={`spill ${member.role === 'OWNER' ? 'off' : ''}`}>{ROLE_LABEL[member.role]}</span>
            <span className="chev">›</span>
          </button>;
        })}
        {invites.map(invite => <div className="team-invitation" key={invite.id} data-testid="settings-invites">
          <span className="team-link-icon"><Link2 size={16} /></span>
          <div className="info"><b>{invite.email || `Link para ${ROLE_LABEL[invite.role]}`}</b><small>{ROLE_LABEL[invite.role]} · vence el {new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(invite.expiresAt))}</small></div>
          <div className="team-invite-actions"><button type="button" aria-label="Copiar link" disabled={!invite.inviteUrl} onClick={() => { void copyLink(invite.inviteUrl); }}><Link2 size={17} /></button><a onClick={() => track('invite_shared', { channel: 'whatsapp' })} aria-label="Compartir por WhatsApp" href={`https://wa.me/?text=${encodeURIComponent(`Sumate al equipo de ${store?.name}: ${invite.inviteUrl}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /></a>{appSession?.membership?.role === 'OWNER' || invite.role === 'STAFF' ? <button className="cancel" type="button" aria-label="Cancelar invitación" disabled={busyInvite === invite.id} onClick={() => setRevokeId(invite.id)}><X size={17} /></button> : null}</div>
        </div>)}
        <button className="invite" type="button" data-testid="settings-invite" onClick={() => open({ type: 'invite' })}>+ Invitar al equipo</button>
      </div>
    </div>
    {revokeId ? <div className="ov center"><div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="revoke-invite-title"><h2 id="revoke-invite-title">¿Cancelás esta invitación?</h2><p>El link deja de servir y la persona no va a poder sumarse.</p><div className="sacts"><button className="btn2 s" type="button" onClick={() => setRevokeId(null)}>Volver</button><button className="btn2 danger" type="button" disabled={busyInvite === revokeId} onClick={() => revoke(revokeId)}>Cancelar invitación</button></div></div></div> : null}
  </>;
  const selected = place.memberId ? members.find(member => member.id === place.memberId) ?? null : null;

  if (place.memberId && selected) {
    return (
      <MemberPermissions
        member={selected}
        onBack={closeMember}
        onRemoved={load}
        onSaved={(member) => setMembers((current) => current.map((item) => item.id === member.id ? { ...item, ...member } : item))}
      />
    );
  }

  if (place.page === 'team' && seeTeam) return <div className="dscreen team-page" data-testid="team-screen"><PageHead back={() => writeHash(configHash('settings'), 'replace')} title="Equipo" subtitle={members.length === 1 && !invites.length ? 'Solo vos por ahora' : `${countLabel(members.length, 'persona', 'personas')} · ${countLabel(invites.length, 'invitación', 'invitaciones')}`} />{teamContent}</div>;

  return (
    <div className="dscreen" data-testid="settings-screen">
      <PageHead title="Configuración" subtitle="Tienda, equipo y tu cuenta" back={back} />
      <div className="settings-grid">
        {!isStaff && (
          <>
            <div className="sec" data-testid="settings-store">Tienda</div>
            {!store?.instagram?.trim() ? (
              <p className="ig-notice" data-testid="settings-instagram-notice" role="status">
                Falta el Instagram de la tienda. Podés seguir usando la app y cargarlo en los datos de la tienda.
              </p>
            ) : null}
            <div className="card">
              <MRow icon={<DeskIcon name="store" size={18} />} title={store?.name || 'Tienda'} sub={contactSummary(store)} onClick={() => open({ type: 'store' })} />
              <MRow icon={<DeskIcon name="cal" size={18} />} title="Garantías" sub="Usados, sellados y reparaciones" onClick={() => open({ type: 'warranty' })} />
            </div>
            {teamContent}
          </>
        )}
        <div className="sec" data-testid="settings-account">Mi cuenta</div>
        <div className="card">
          <MRow icon={<ImanagerIcon name="cliente" size={20} />} title="Perfil" sub={`${me?.displayName || 'Usuario'} · ${me?.email || ''}`} onClick={() => open({ type: 'profile' })} />
          <MRow icon={<DeskIcon name="lock" size={18} />} title="Seguridad" sub="Cambiar contraseña" onClick={() => open({ type: 'password' })} />
          {appSession?.membership?.role === 'OWNER' ? <MRow icon={<DeskIcon name="card" size={18} />} title="Plan y facturación" sub={billingAccountSubtitle(appSession?.billing)} onClick={() => go('billing')} /> : null}
        </div>
        <div className="logout"><button type="button" data-testid="settings-logout" onClick={() => open({ type: 'logout' })}>Cerrar sesión</button></div>
      </div>
    </div>
  );
}
