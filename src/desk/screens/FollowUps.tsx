import { useEffect, useMemo, useState } from 'react';
import { Cake, Clock, MessageCircle, Receipt, Shield, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../../context/AppContext';
import { whatsappLink } from '../../catalog/presentation';
import { toActionMessage, toUserMessage, isNetworkErrorMessage } from '../../lib/user-message';
import { fetchFollowUps, saveFollowUpSettings, type FollowUpCard, type FollowUpGroup, type FollowUpKind, type FollowUpSettings } from '../../services/accounts-api';
import { useMoney } from '../exchange';
import { avatarTone, initials } from '../format';
import {
  FOLLOW_UP_LABEL,
  FOLLOW_UP_ORDER,
  followUpAside,
  followUpClientsLabel,
  followUpFact,
  followUpMessage,
  followUpTodayLabel,
} from '../follow-up-copy';
import { ListSkeleton } from '../list-skeleton';
import { usePhoneLayout } from '../section-notices';
import { Actions, ChipRow, Field, ScreenTitle, Sheet, useDesk } from '../ui';

const ICONS = {
  DEUDA: Receipt,
  CUMPLEANOS: Cake,
  GARANTIA: Shield,
  INACTIVO: Clock,
} satisfies Record<FollowUpKind, typeof Receipt>;

function WhatsAppGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12.04 3.2A8.7 8.7 0 0 0 3.3 11.9c0 1.53.4 3.02 1.16 4.34L3.2 20.8l4.68-1.23a8.7 8.7 0 0 0 4.16 1.06h.01a8.7 8.7 0 0 0 0-17.43zm0 15.94h-.01a7.22 7.22 0 0 1-3.68-1l-.26-.16-2.78.73.74-2.71-.17-.28a7.23 7.23 0 1 1 6.16 3.42zm3.97-5.41c-.22-.11-1.28-.63-1.48-.7-.2-.07-.34-.11-.48.11-.14.22-.55.7-.67.84-.12.15-.25.16-.47.05-.22-.11-.91-.33-1.74-1.07-.64-.57-1.08-1.28-1.2-1.5-.13-.22-.01-.33.1-.44.1-.1.22-.25.33-.37.11-.12.15-.22.22-.36.07-.15.04-.27-.02-.38-.05-.11-.48-1.16-.66-1.59-.17-.41-.35-.36-.48-.36h-.41c-.14 0-.37.05-.56.27-.2.22-.74.72-.74 1.76s.76 2.04.86 2.18c.11.15 1.49 2.28 3.62 3.2.5.22.9.35 1.21.45.51.16.97.14 1.33.08.41-.06 1.28-.52 1.46-1.03.18-.5.18-.94.13-1.03-.05-.1-.2-.15-.42-.26z" />
    </svg>
  );
}

function WhatsAppAction({ href, name, tipId }: { href: string | null; name: string; tipId: string }) {
  if (href) {
    return (
      <a className="fu-wa" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Escribirle a ${name} por WhatsApp`}>
        <WhatsAppGlyph />
      </a>
    );
  }
  return (
    <span className="fu-wa-wrap">
      <button type="button" className="fu-wa" disabled aria-label={`WhatsApp no disponible para ${name}`} aria-describedby={tipId}>
        <WhatsAppGlyph />
      </button>
      <span role="tooltip" id={tipId} className="fu-tip">Cargá su teléfono para escribirle por WhatsApp</span>
    </span>
  );
}

export function FollowUpsScreen() {
  const { back } = useDesk();
  return (
    <div className="dscreen">
      <ScreenTitle title="Seguimientos" back={back} desktop={null} />
      <FollowUps />
    </div>
  );
}

export function FollowUps({ query = '' }: { query?: string }) {
  const { user } = useAppContext();
  const { open, toast } = useDesk();
  const phone = usePhoneLayout();
  const money = useMoney();
  const show = (amount: number, currency: string | null) => money.show(amount, currency);
  const [cards, setCards] = useState<FollowUpCard[]>([]);
  const [groups, setGroups] = useState<FollowUpGroup[]>([]);
  const [settings, setSettings] = useState<FollowUpSettings | null>(null);
  const [today, setToday] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('todos');

  const load = (quiet = false) => {
    if (!user) return;
    if (!quiet) setLoading(true);
    fetchFollowUps(user).then((data) => {
      setCards(data.cards);
      setGroups(data.groups ?? []);
      setSettings(data.settings);
      setToday(data.today);
      setError('');
    }).catch((cause: unknown) => setError(toUserMessage(cause, 'No se pudieron cargar los seguimientos'))).finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [user]);

  const needle = query.trim().toLowerCase();
  const searched = useMemo(
    () => cards.filter((card) => !needle || `${card.name} ${card.phone}`.toLowerCase().includes(needle)),
    [cards, needle],
  );
  const counts = useMemo(() => {
    const tally = new Map<FollowUpKind, number>();
    for (const card of cards) tally.set(card.kind, (tally.get(card.kind) ?? 0) + 1);
    return tally;
  }, [cards]);
  const chips = [
    { id: 'todos', label: `Todos ${cards.length}` },
    ...FOLLOW_UP_ORDER.filter((kind) => (counts.get(kind) ?? 0) > 0).map((kind) => ({ id: kind, label: `${FOLLOW_UP_LABEL[kind].chip} ${counts.get(kind) ?? 0}` })),
  ];
  const visibleGroups = FOLLOW_UP_ORDER.filter((kind) => filter === 'todos' || filter === kind).map((kind) => {
    const rows = searched.filter((card) => card.kind === kind);
    const server = groups.find((group) => group.kind === kind);
    return { kind, rows, server };
  }).filter((group) => group.rows.length > 0);

  const subtitle = !today ? '' : cards.length
    ? `${followUpClientsLabel(cards.length)} · ${followUpTodayLabel(today)}`
    : `Hoy no hay pendientes · ${followUpTodayLabel(today)}`;

  return (
    <section className="fu-screen" aria-label="Seguimientos" data-testid="follow-ups">
      <div className="fu-head">
        <div>
          <h2>A quién escribir hoy</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {settings ? <button className="fu-rules" type="button" onClick={() => setEditing(true)}><Sparkles size={15} />Reglas</button> : null}
      </div>
      {error && !isNetworkErrorMessage(error) ? <div className="ferr" role="alert">{error}<button className="wlink" type="button" onClick={() => load()}>Reintentar</button></div> : null}
      {loading ? <ListSkeleton variant="cards" rows={3} testId="follow-ups-loading" /> : null}
      {!loading && cards.length > 0 ? (
        <div className="fu-chips">
          <ChipRow options={chips} value={filter} onChange={setFilter} />
        </div>
      ) : null}
      {!loading && !error && cards.length === 0 ? (
        <div className="fu-empty" data-testid="follow-empty">
          <span className="fu-empty-icon"><MessageCircle size={26} /></span>
          <b>Hoy no hay a quién escribir</b>
          <p>Acá aparecen las deudas, los cumpleaños, las garantías por vencer y quienes hace tiempo no compran.</p>
          {settings ? <button className="dbtn s" type="button" onClick={() => setEditing(true)}>Revisar reglas</button> : null}
        </div>
      ) : null}
      {!loading && cards.length > 0 && visibleGroups.length === 0 ? <div className="table-empty">No hay seguimientos con esa búsqueda.</div> : null}
      {!loading ? (
        <div className="fu-groups">
          {visibleGroups.map((group) => {
            const Icon = ICONS[group.kind];
            const label = FOLLOW_UP_LABEL[group.kind];
            const sameSet = !needle && (filter === 'todos' || filter === group.kind);
            const aside = settings ? followUpAside({
              kind: group.kind,
              settings,
              cards: group.rows,
              today,
              totalAmount: sameSet ? (group.server?.totalAmount ?? null) : debtTotal(group.rows),
              currency: sameSet ? (group.server?.currency ?? null) : group.rows[0]?.currency ?? null,
              show,
            }) : '';
            return (
              <motion.section
                key={group.kind}
                className="fu-group"
                data-testid={`follow-group-${group.kind}`}
                aria-label={label.group}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <header className="fu-gh">
                  <span className={`fu-kicker ${group.kind.toLowerCase()}`}>
                    <Icon size={15} />
                    <b>{label.group}</b>
                    <span>· {group.rows.length}</span>
                  </span>
                  {aside ? <span data-ph-mask={group.kind === 'DEUDA' || undefined} className="fu-aside">{aside}</span> : null}
                </header>
                {group.rows.map((card) => {
                  const fact = followUpFact(card, today, show);
                  const link = whatsappLink(card.phone, followUpMessage(card));
                  return (
                    <article className={`fu-row${link ? '' : ' has-extra'}`} key={card.id} data-testid={`follow-${card.kind}`}>
                      <div className="fu-who">
                        <span data-ph-mask className={`av-c ${avatarTone(card.name)}`}>{initials(card.name)}</span>
                        <span>
                          <b data-ph-mask>{card.name}</b>
                          {phone ? null : <small data-ph-mask>{card.phone.trim() || 'Sin teléfono'}</small>}
                        </span>
                      </div>
                      {phone ? null : (
                        <span className={`fu-badge ${group.kind.toLowerCase()}`}>
                          <Icon size={14} />
                          {label.badge}
                        </span>
                      )}
                      <div className="fu-fact">
                        {fact.primary ? <strong data-ph-mask={fact.debt || undefined} className={fact.debt ? 'debt' : undefined}>{fact.primary}</strong> : null}
                        {fact.secondary ? <span>{fact.secondary}</span> : null}
                      </div>
                      {link ? null : (
                        <div className="fu-extra">
                          {phone || card.phone.trim() ? null : <span className="fu-nophone">Sin teléfono</span>}
                          <button className="wlink fu-add" type="button" onClick={() => open({ type: 'cl', id: card.clientId })}>
                            {phone ? 'Agregar teléfono' : 'Agregar'}
                          </button>
                        </div>
                      )}
                      <div className="fu-wa-slot">
                        <WhatsAppAction href={link} name={card.name} tipId={`wa-${card.id}`} />
                      </div>
                    </article>
                  );
                })}
              </motion.section>
            );
          })}
        </div>
      ) : null}
      {editing && settings ? <FollowSettings initial={settings} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast('Reglas guardadas'); load(true); }} /> : null}
    </section>
  );
}

function debtTotal(rows: FollowUpCard[]) {
  const amounts = rows.filter((row) => row.kind === 'DEUDA' && row.amount != null);
  if (!amounts.length) return null;
  const currency = amounts[0]?.currency ?? null;
  if (amounts.some((row) => (row.currency ?? null) !== currency)) return null;
  return Math.round(amounts.reduce((sum, row) => sum + (row.amount ?? 0), 0) * 100) / 100;
}

function FollowSettings({ initial, onClose, onSaved }: { initial: FollowUpSettings; onClose: () => void; onSaved: () => void }) {
  const { user } = useAppContext();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<FollowUpSettings>) => setForm((current) => ({ ...current, ...patch }));
  const save = async () => {
    if (!user) return;
    setBusy(true);
    setError('');
    try { await saveFollowUpSettings(user, form); onSaved(); }
    catch (cause) { setError(toActionMessage(cause, 'No se pudieron guardar las reglas')); setBusy(false); }
  };
  return (
    <Sheet title="Reglas de seguimiento" onClose={() => { if (!busy) onClose(); }}>
      {error && !isNetworkErrorMessage(error) ? <div className="ferr" role="alert">{error}</div> : null}
      <Field label="Días de anticipación del cumpleaños"><input aria-label="Anticipación del cumpleaños" inputMode="numeric" value={String(form.birthdayLeadDays)} onChange={(event) => set({ birthdayLeadDays: Number(event.target.value.replace(/\D/g, '') || 0) })} /></Field>
      <Field label="Días de anticipación de la garantía"><input aria-label="Anticipación de la garantía" inputMode="numeric" value={String(form.warrantyLeadDays)} onChange={(event) => set({ warrantyLeadDays: Number(event.target.value.replace(/\D/g, '') || 0) })} /></Field>
      <Field label="Días sin comprar"><input aria-label="Días sin comprar" inputMode="numeric" value={String(form.inactiveDays)} onChange={(event) => set({ inactiveDays: Number(event.target.value.replace(/\D/g, '') || 0) })} /></Field>
      <label className="op-check"><input type="checkbox" checked={form.includeDebts} onChange={(event) => set({ includeDebts: event.target.checked })} />Incluir deudas pendientes</label>
      <p className="eqs-note">El cumpleaños se carga en la ficha del cliente. La garantía es la de cada venta. El recordatorio automático queda para más adelante: acá solo se abre WhatsApp.</p>
      <Actions busy={busy} primary="Guardar reglas" onPrimary={() => { void save(); }} onSecondary={onClose} secondary="Cerrar" />
    </Sheet>
  );
}
