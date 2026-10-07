import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { Client, Product, Sale, TradeIn } from '../../types';
import { listInvitations, type Invitation } from '../../services/invitations-api';
import { listMembers, type TeamMember } from '../../services/members-api';
import { contactSummary } from '../../lib/store-contact';
import { formatArDate, formatMoney, initials, parseAppDate, relTime, saleCode, tradeCode } from '../format';
import { ChipRow, DeskIcon, PageHead, useDesk } from '../ui';

type NoteTab = 'sales' | 'tradeins' | 'inventory' | 'clients' | 'settings';
type Note = { id: string; title: string; body: string; when: string; at: number; tab: NoteTab };

export function NotificationsScreen() {
  const { sales, tradeIns, inventory, clients, appSession, user } = useAppContext();
  const { go, toast } = useDesk();
  const storeId = appSession?.store?.id ?? 'local';
  const key = `imanager-desk-read:${storeId}`;
  const [read, setRead] = useState<string[]>([]);
  const [filter, setFilter] = useState('Todas');
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    try { setRead(JSON.parse(localStorage.getItem(key) || '[]')); } catch { setRead([]); }
  }, [key]);

  useEffect(() => {
    if (!user || !appSession?.store?.id) return;
    listMembers(user, appSession.store.id).then(setMembers).catch(() => setMembers([]));
  }, [user, appSession?.store?.id]);

  const notes = useMemo(() => buildNotes(sales, tradeIns, inventory, clients, members), [sales, tradeIns, inventory, clients, members]);
  const unread = notes.filter((note) => !read.includes(note.id)).length;
  const visible = notes.filter((note) => filter === 'Todas' || !read.includes(note.id));

  const mark = (id: string, tab: NoteTab) => {
    const next = read.includes(id) ? read : [...read, id];
    setRead(next);
    localStorage.setItem(key, JSON.stringify(next));
    go(tab);
  };

  const markAll = () => {
    const next = notes.map((note) => note.id);
    setRead(next);
    localStorage.setItem(key, JSON.stringify(next));
    toast('Todo leído');
  };

  return (
    <div className="dscreen">
      <PageHead
        title="Notificaciones"
        subtitle={unread ? `${unread} sin leer` : 'Todo al día'}
        action={unread > 0 ? <button className="wlink" type="button" onClick={markAll}>Leer todas</button> : undefined}
      />
      <div style={{ padding: '0 20px 12px', maxWidth: 860 }}>
        <ChipRow options={[{ id: 'Todas', label: 'Todas' }, { id: 'unread', label: 'Sin leer' }]} value={filter} onChange={setFilter} />
      </div>
      {visible.length === 0 ? <div className="wempty" style={{ maxWidth: 860 }}>Estás al día. No hay notificaciones sin leer.</div> : (
        <div className="card" style={{ maxWidth: 860 }}>
          {visible.map((note) => {
            const seen = read.includes(note.id);
            return (
              <button key={note.id} className="member" type="button" onClick={() => mark(note.id, note.tab)}>
                <div className={`ico-row${seen ? '' : ' l'}`}><DeskIcon name="note" size={18} /></div>
                <div className="info"><div className="name">{note.title}</div><div className="role">{note.when ? `${note.body} · ${note.when}` : note.body}</div></div>
                {seen ? <span className="chev">›</span> : <span className="unread" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function useUnreadCount() {
  const { sales, tradeIns, inventory, clients, appSession } = useAppContext();
  const storeId = appSession?.store?.id ?? 'local';
  const notes = buildNotes(sales, tradeIns, inventory, clients);
  let read: string[] = [];
  try { read = JSON.parse(localStorage.getItem(`imanager-desk-read:${storeId}`) || '[]'); } catch { read = []; }
  return notes.filter((note) => !read.includes(note.id)).length;
}

function buildNotes(
  sales: Sale[],
  tradeIns: TradeIn[],
  inventory: Product[],
  clients: Client[],
  members: TeamMember[] = [],
): Note[] {
  const notes: Note[] = [];
  const nameOf = (id: string) => clients.find((client) => client.id === id)?.name ?? 'Sin cliente';
  const atOf = (value: string) => parseAppDate(value)?.getTime() ?? 0;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const trade of tradeIns.filter((item) => item.status === 'PENDIENTE')) {
    notes.push({ id: `cj-${trade.id}`, title: 'Nuevo canje pendiente', body: `${tradeCode(tradeIns, trade.id)} · ${nameOf(trade.clientId)}`, when: relTime(trade.date), at: atOf(trade.date), tab: 'tradeins' });
  }
  for (const sale of sales.filter((item) => item.status !== 'CANCELADA' && atOf(item.date) >= weekAgo)) {
    notes.push({ id: `sale-${sale.id}`, title: 'Venta registrada', body: `${saleCode(sale)} · ${formatMoney(sale.amount)}`, when: relTime(sale.date), at: atOf(sale.date), tab: 'sales' });
  }
  for (const item of inventory.filter((row) => row.status === 'EN_REVISION')) {
    notes.push({ id: `eq-${item.id}`, title: 'Equipo en revisión', body: `${item.model} · ${item.capacity}`, when: '', at: 0, tab: 'inventory' });
  }
  for (const member of members) {
    const at = Date.parse(member.createdAt) || 0;
    notes.push({ id: `mb-${member.id}`, title: `${member.user.displayName || member.user.email || 'Alguien'} se unió`, body: 'Ahora es parte del equipo', when: relTime(member.createdAt), at, tab: 'settings' });
  }
  for (const client of clients.filter((row) => row.pendingBalance > 0).slice(0, 4)) {
    notes.push({ id: `cl-${client.id}`, title: 'Saldo pendiente', body: `${client.name} · ${formatMoney(client.pendingBalance)}`, when: '', at: 0, tab: 'clients' });
  }
  return notes.sort((a, b) => b.at - a.at);
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
                <div className="member" key={member.id}>
                  <div className={`av-c ${['b', 'p', 'g'][index % 3]}`}>{initials(member.user.displayName || member.user.email || 'U')}</div>
                  <div className="info">
                    <div className="name">{member.user.displayName || member.user.email}</div>
                    <div className="role">{member.user.email}</div>
                  </div>
                  {member.userId === me?.id ? <span className="spill mid">vos</span> : null}
                  <span className={`spill ${member.role === 'OWNER' ? 'off' : 'mid'}`}>{ROLE_LABEL[member.role] ?? member.role}</span>
                </div>
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
          <MRow icon={<DeskIcon name="user" size={18} />} title="Perfil" sub={`${me?.displayName || 'Usuario'} · ${me?.email || ''}`} onClick={() => open({ type: 'profile' })} />
          <MRow icon={<DeskIcon name="lock" size={18} />} title="Seguridad" sub="Cambiar contraseña" onClick={() => open({ type: 'password' })} />
          <MRow icon={<DeskIcon name="card" size={18} />} title="Facturación" sub="Usuario Beta" right="Acceso anticipado" onClick={() => toast('Estás en el acceso anticipado.')} />
        </div>
        <div className="logout"><button type="button" onClick={() => open({ type: 'logout' })}>Cerrar sesión</button></div>
      </div>
    </div>
  );
}
