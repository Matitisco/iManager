import { useEffect, useMemo, useState } from 'react';
import { Bell, Lock, Store, UserRound } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { listInvitations, revokeInvitation, type Invitation } from '../../services/invitations-api';
import { listMembers, type TeamMember } from '../../services/members-api';
import { initials, isOpenTrade } from '../format';
import { ChipRow, PageHead, useDesk } from '../ui';

type Note = { id: string; title: string; body: string; when: string; tab: 'sales' | 'tradeins' | 'inventory' | 'clients' };

export function NotificationsScreen() {
  const { sales, tradeIns, inventory, clients, appSession } = useAppContext();
  const { go, toast } = useDesk();
  const storeId = appSession?.store?.id ?? 'local';
  const key = `imanager-desk-read:${storeId}`;
  const [read, setRead] = useState<string[]>([]);
  const [filter, setFilter] = useState('Todas');

  useEffect(() => {
    try { setRead(JSON.parse(localStorage.getItem(key) || '[]')); } catch { setRead([]); }
  }, [key]);

  const notes = useMemo(() => buildNotes(sales, tradeIns, inventory, clients), [sales, tradeIns, inventory, clients]);
  const visible = notes.filter((note) => filter === 'Todas' || !read.includes(note.id));

  const mark = (id: string, tab: Note['tab']) => {
    const next = read.includes(id) ? read : [...read, id];
    setRead(next);
    localStorage.setItem(key, JSON.stringify(next));
    go(tab);
  };

  const markAll = () => {
    const next = notes.map((note) => note.id);
    setRead(next);
    localStorage.setItem(key, JSON.stringify(next));
    toast('Listo');
  };

  return (
    <div className="dscreen">
      <PageHead
        title="Notificaciones"
        subtitle={`${notes.filter((note) => !read.includes(note.id)).length || 'Nada'} sin leer`}
        action={<button className="wlink" type="button" onClick={markAll}>Leer todas</button>}
      />
      <div className="dbar">
        <ChipRow options={[{ id: 'Todas', label: 'Todas' }, { id: 'unread', label: 'Sin leer' }]} value={filter} onChange={setFilter} />
      </div>
      <div className="dcard" style={{ maxWidth: 760 }}>
        {visible.length === 0 ? <div className="wempty">Estás al día.</div> : visible.map((note) => (
          <button key={note.id} className="member" type="button" onClick={() => mark(note.id, note.tab)}>
            <div className="dthumb"><Bell size={16} /></div>
            <div className="info"><div className="name">{note.title}</div><div className="role">{note.body} · {note.when}</div></div>
            {!read.includes(note.id) ? <span className="unread" /> : null}
          </button>
        ))}
      </div>
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
  sales: { id: string; date: string; amount: number; status: string; clientId: string; productId: string }[],
  tradeIns: { id: string; date: string; status: string; clientId: string; deviceReceived: string }[],
  inventory: { id: string; model: string; capacity: string; status: string }[],
  clients: { id: string; name: string; pendingBalance: number }[],
): Note[] {
  const notes: Note[] = [];
  const nameOf = (id: string) => clients.find((client) => client.id === id)?.name ?? 'Sin cliente';
  for (const trade of tradeIns.filter((item) => isOpenTrade(item.status)).slice(0, 6)) {
    notes.push({ id: `cj-${trade.id}`, title: 'Canje en curso', body: `${nameOf(trade.clientId)} · ${trade.deviceReceived}`, when: trade.date || 'hoy', tab: 'tradeins' });
  }
  for (const sale of sales.filter((item) => item.status === 'PENDIENTE').slice(0, 6)) {
    notes.push({ id: `sale-${sale.id}`, title: 'Venta pendiente', body: nameOf(sale.clientId), when: sale.date, tab: 'sales' });
  }
  for (const item of inventory.filter((row) => row.status === 'EN_REVISION').slice(0, 6)) {
    notes.push({ id: `eq-${item.id}`, title: 'Equipo en revisión', body: `${item.model} ${item.capacity}`, when: 'en stock', tab: 'inventory' });
  }
  for (const client of clients.filter((row) => row.pendingBalance > 0).slice(0, 4)) {
    notes.push({ id: `cl-${client.id}`, title: 'Saldo pendiente', body: client.name, when: 'clientes', tab: 'clients' });
  }
  return notes;
}

const ROLE_LABEL: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Socio', STAFF: 'Agente' };

export function SettingsScreen() {
  const { appSession, user, logout } = useAppContext();
  const { open, isStaff } = useDesk();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);

  const load = () => {
    if (!user || !appSession?.store?.id) return;
    listMembers(user, appSession.store.id).then(setMembers).catch(() => setMembers([]));
    if (!isStaff) listInvitations(user).then(setInvites).catch(() => setInvites([]));
  };

  useEffect(() => { load(); }, [user, appSession?.store?.id]);

  const me = appSession?.user;
  const store = appSession?.store;
  const role = ROLE_LABEL[appSession?.membership?.role ?? 'STAFF'] ?? 'Agente';

  return (
    <div className="dscreen">
      <PageHead title="Configuración" subtitle="Tienda, equipo y tu cuenta" />
      <div className="settings-grid">
        {!isStaff && (
          <>
            <div className="sec">Tienda</div>
            <div className="dcard">
              <button className="member" type="button" onClick={() => open({ type: 'store' })}>
                <div className="dthumb"><Store size={16} /></div>
                <div className="info"><div className="name">{store?.name}</div><div className="role">Nombre, CUIT y moneda</div></div>
              </button>
            </div>
            <div className="sec">Equipo</div>
            <div className="dcard">
              {members.map((member) => (
                <div className="member" key={member.id}>
                  <div className={`av-c b`}>{initials(member.user.displayName || member.user.email || 'U')}</div>
                  <div className="info">
                    <div className="name">{member.user.displayName || member.user.email}</div>
                    <div className="role">{member.user.email}</div>
                  </div>
                  <span className="spill mid">{ROLE_LABEL[member.role] ?? member.role}</span>
                </div>
              ))}
              {invites.map((invite) => (
                <div className="member" key={invite.id}>
                  <div className="info"><div className="name">Invitación {ROLE_LABEL[invite.role] ?? invite.role}</div><div className="role">Vence {new Date(invite.expiresAt).toLocaleDateString('es-AR')}</div></div>
                  <button className="wlink" type="button" onClick={() => user && revokeInvitation(user, invite.id).then(load)}>Cancelar</button>
                </div>
              ))}
              <button className="invite" type="button" onClick={() => open({ type: 'invite' })}>+ Invitar al equipo</button>
            </div>
          </>
        )}
        <div className="sec">Mi cuenta</div>
        <div className="dcard">
          <button className="member" type="button" onClick={() => open({ type: 'profile' })}>
            <div className="dthumb"><UserRound size={16} /></div>
            <div className="info"><div className="name">Perfil</div><div className="role">{me?.displayName} · {me?.email}</div></div>
          </button>
          <button className="member" type="button" onClick={() => open({ type: 'password' })}>
            <div className="dthumb"><Lock size={16} /></div>
            <div className="info"><div className="name">Seguridad</div><div className="role">Cambiar contraseña</div></div>
          </button>
          <div className="member">
            <div className="info"><div className="name">Rol</div><div className="role">{store?.name}</div></div>
            <span className="spill mid">{role}</span>
          </div>
        </div>
        <div className="logout"><button type="button" onClick={() => logout()}>Cerrar sesión</button></div>
      </div>
    </div>
  );
}
