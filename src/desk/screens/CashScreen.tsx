import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { toUserMessage } from '../../lib/user-message';
import type { CashCommand, CashFilters, CashHistory, CashMovement, CashRegister, CashSession } from '../../types/cash';
import { financeDate, financeDateTime, financeDay, openingDescription } from '../finance-dates';
import { usePhoneLayout } from '../section-notices';
import { Actions, Field, PageHead, Segs, Sheet, useDesk } from '../ui';
import { DeskSelect } from '../select';
import { useCommissionBlue } from '../commission-blue';
import './cash.css';

const denominations = { ARS: [20000,10000,2000,1000,500,200,100,50,20,10,5,2,1], USD: [100,50,20,10,5,2,1,0.25,0.1,0.05,0.01] };
const status: Record<string, string> = { OPEN: 'Abierta', SUBMITTED: 'Esperando aprobación', RECOUNT: 'Recontar', APPROVED: 'Cerrada' };
const kind: Record<string, string> = { COBRO: 'Cobro', DEVOLUCION: 'Devolución', INGRESO: 'Ingreso', EGRESO: 'Egreso', AJUSTE: 'Ajuste de saldo', TRANSFERENCIA: 'Transferencia / conversión', FONDO: 'Saldo inicial', ARQUEO: 'Ajuste de arqueo', ANULACION: 'Anulación' };
export const cashMoney = (amount: number, currency: string) => `${currency} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
type Mode = { type: 'create' } | { type: 'edit' | 'INGRESO' | 'EGRESO' | 'AJUSTE' | 'count' | 'recount' | 'transfer'; box: CashRegister } | { type: 'void' | 'category'; movement: CashMovement; box: CashRegister };

export function CashScreen() {
  const { cashData, loadCash, mutateCash, loadCashHistory, loadCashSessions, appSession } = useAppContext();
  const { back, toast } = useDesk();
  const phone = usePhoneLayout();
  const owner = appSession?.membership?.role === 'OWNER';
  const zone = appSession?.store?.timezone ?? 'America/Argentina/Buenos_Aires';
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const today = financeDay(now, zone);
  const [selected, setSelected] = useState('');
  const [archived, setArchived] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState<CashFilters>({ offset: 0 });
  const [draftFilters, setDraftFilters] = useState<CashFilters>({});
  const [history, setHistory] = useState<CashHistory | null>(null);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { await loadCash(); } catch (err) { setError(toUserMessage(err, 'No se pudieron cargar las cajas')); }
    finally { setLoading(false); }
  }, [loadCash]);
  useEffect(() => { void refresh(); }, [refresh, revision]);
  useEffect(() => {
    const reload = () => { void refresh(); setRevision(n => n + 1); };
    const focus = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('online', reload); document.addEventListener('visibilitychange', focus);
    return () => { window.removeEventListener('online', reload); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);
  const box = cashData?.registers.find(row => row.id === selected);
  const view = Boolean(cashData?.canViewBalances);
  useEffect(() => {
    let active = true;
    setHistory(null); setSessions([]); setHistoryError('');
    if (!selected || !view) return;
    setHistoryLoading(true);
    void Promise.all([loadCashHistory(selected, filters), loadCashSessions(selected)]).then(([rows, result]) => {
      if (active) { setHistory(rows); setSessions(result.sessions); }
    }).catch(err => { if (active) setHistoryError(toUserMessage(err, 'No se pudo cargar el historial')); }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [selected, view, filters, revision, loadCashHistory, loadCashSessions]);
  const save = async (command: CashCommand) => {
    if (sending.current) return;
    sending.current = true; setBusy(true);
    try {
      await mutateCash(command);
      setMode(null); toast('Cambio guardado en caja'); setRevision(n => n + 1);
    } finally { sending.current = false; setBusy(false); }
  };
  const direct = async (command: CashCommand) => {
    setError('');
    try { await save(command); } catch (err) { setError(toUserMessage(err, 'No se pudo guardar el cambio')); }
  };
  const rows = cashData?.registers.filter(row => Boolean(row.archivedAt) === archived) ?? [];
  return <div className="dscreen cash-screen" data-testid="cash-screen">
    <div className="cash-content" hidden={mode?.type === 'count'}>
    <PageHead title="Cajas" subtitle={box ? `${box.currency} · ${box.method === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'}` : (phone ? 'Ingresos, egresos y cierre' : 'Ingresos, egresos y cierre diario por moneda y medio')} back={selected ? () => { setSelected(''); setFilters({ offset: 0 }); setDraftFilters({}); } : back} action={owner && !selected ? <button className="dbtn s" onClick={() => setMode({ type: 'create' })}>Nueva caja</button> : selected ? <button className="dbtn s" onClick={() => setSelected('')}>Todas las cajas</button> : undefined} />
    {error ? <div className="ferr" role="alert">{error}<button className="dbtn s" onClick={() => { void refresh(); }}>Reintentar</button></div> : null}
    {loading && !cashData ? <p role="status">Cargando cajas…</p> : null}
    {!selected && cashData ? <>
      <Segs options={[{ id: 'active', label: 'Activas' }, { id: 'archived', label: 'Archivadas' }]} value={archived ? 'archived' : 'active'} onChange={value => setArchived(value === 'archived')} />
      {!rows.length ? <div className="card cash-empty"><h3>{archived ? 'No hay cajas archivadas' : owner ? 'Creá tu primera caja' : 'No hay cajas configuradas'}</h3><p>Pesos y dólares llevan saldos y cierres separados. La primera caja de cada moneda y medio recibe los cobros automáticamente.</p>{owner && !archived ? <button className="dbtn" onClick={() => setMode({ type: 'create' })}>Crear caja</button> : null}</div> : <div className="cash-grid">{rows.map(row => <button className="card cash-box" key={row.id} onClick={() => { setSelected(row.id); setFilters({ offset: 0 }); setDraftFilters({}); }}>
        <span className="cash-box-top"><b>{row.name}</b><span className="cash-currency">{row.currency}</span></span>
        <span>{row.method === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'}{row.isDefault ? ' · Predeterminada' : ''}</span>
        <strong>{!view || row.balance === undefined ? 'Saldo protegido' : cashMoney(row.balance, row.currency)}</strong>
        <span className={`cash-status ${row.session?.status ?? ''}`}>{row.archivedAt ? 'Archivada' : row.session ? `${status[row.session.status]} · ${financeDate(row.session.day)}` : 'Sin sesiones registradas'}</span>
      </button>)}</div>}
      <p className="cash-help">Las ventas y cobros pueden registrarse sin abrir una caja. Se asignan a una caja compatible abierta, priorizando la predeterminada. No se trasladan movimientos históricos.</p>
    </> : null}
    {box ? <div className="cash-layout">
      <div className="cash-operation">
        <section className="card cash-daily" aria-label="Operación diaria">
          <div className="cash-register-head"><div><h2>{box.name}</h2><p>{box.session?.openedAt ? openingDescription(box.session.openedAt, box.session.openedBy, zone, now) : box.session ? `Jornada del ${financeDate(box.session.day)}` : 'Todavía no hay sesiones ni cierres registrados.'}</p></div><span className={`cash-status ${box.session?.status ?? ''}`}>{box.archivedAt ? 'Archivada' : box.session ? status[box.session.status] : 'Sin historial de sesiones'}</span></div>
          <div className="cash-overview"><div><span>Saldo de caja · {box.currency} · {box.method === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'}</span><strong>{!view || box.balance === undefined ? 'Saldo protegido' : cashMoney(box.balance, box.currency)}</strong>{view && box.session?.opening !== undefined ? <p>Fondo de apertura: {cashMoney(box.session.opening, box.currency)}</p> : null}<p>{box.isDefault ? 'Recibe cobros compatibles mientras está abierta.' : 'Ingresos y transferencias se registran en esta caja.'}</p></div></div>
          {box.session?.reviewNote ? <p className="cash-notice" role="status">Pedido de reconteo: {box.session.reviewNote}</p> : null}
          {!box.archivedAt ? <>
            <div className="cash-actions cash-daily-actions">
              {!box.session || box.session.status === 'APPROVED' && box.session.day < today ? <button disabled={busy} className="dbtn p cash-primary" onClick={() => { void direct({ path: `/${box.id}/open`, method: 'POST' }); }}>Abrir día</button> : null}
              {box.session?.status === 'OPEN' ? <>
                {box.session.day === today ? <>{(['INGRESO','EGRESO'] as const).map(type => <button disabled={busy} className="dbtn s" key={type} onClick={() => setMode({ type, box })}>{type === 'INGRESO' ? 'Ingreso' : 'Egreso'}</button>)}</> : <p className="cash-help">La jornada del {financeDate(box.session.day)} quedó pendiente. Completá su cierre antes de registrar movimientos.</p>}
                <button className="dbtn p cash-primary" onClick={() => setMode({ type: 'count', box })}>Contar y cerrar</button>
              </> : null}
              {box.session?.status === 'RECOUNT' ? <button className="dbtn p cash-primary" onClick={() => setMode({ type: 'count', box })}>Recontar caja</button> : null}
            </div>
            {box.session?.status === 'OPEN' && box.session.day === today ? <button className="cash-convert" disabled={busy} onClick={() => setMode({ type: 'transfer', box })}><span aria-hidden="true">⇄ </span>Convertir fondos</button> : null}
            {box.session?.status === 'APPROVED' && box.session.day >= today ? <p className="cash-notice">Esta caja ya cerró hoy. Podés abrirla el próximo día.</p> : null}
          </> : null}
          {box.session?.status === 'SUBMITTED' ? <p className="cash-notice">Al aprobar, la diferencia del último conteo ajusta el saldo y queda en el historial. Solo el dueño puede aprobar o pedir reconteo. Los movimientos están pausados.</p> : null}
        </section>
        {box.session?.counts?.length ? <section className="card cash-close-result" data-testid="cash-close-result"><h3>{box.session.status === 'APPROVED' ? 'Cierre aprobado' : 'Conteo guardado'}</h3><CountResult session={box.session} currency={box.currency} timeZone={zone} />{owner && box.session.status === 'SUBMITTED' ? <div className="cash-actions"><button className="dbtn p" disabled={busy} onClick={() => { void direct({ path: `/sessions/${box.session!.id}/review`, method: 'POST', body: { action: 'APPROVE' } }); }}>Aprobar cierre</button><button className="dbtn s" disabled={busy} onClick={() => setMode({ type: 'recount', box })}>Pedir reconteo</button></div> : null}</section> : null}
        {view ? <section className="cash-movements" aria-label="Movimientos de caja">
        <h3 className="cash-section">Movimientos</h3>
        <details className="card cash-filter-panel"><summary>Filtrar movimientos</summary>
        <form className="cash-filters" onSubmit={event => { event.preventDefault(); setFilters({ ...draftFilters, offset: 0 }); }}>
          <Field label="Desde"><input type="date" value={draftFilters.from ?? ''} onChange={e => setDraftFilters(f => ({ ...f, from: e.target.value }))} /></Field>
          <Field label="Hasta"><input type="date" value={draftFilters.to ?? ''} onChange={e => setDraftFilters(f => ({ ...f, to: e.target.value }))} /></Field>
          <Field label="Categoría"><DeskSelect label="Categoría del historial" value={draftFilters.category ?? ''} options={[{ value: '', label: 'Todas' }, { value: '__none__', label: 'Sin categoría' }, ...(history?.categories ?? []).map(value => ({ value, label: value }))]} onChange={value => setDraftFilters(f => ({ ...f, category: value }))} /></Field>
          <button className="dbtn s" type="submit">Filtrar</button>
        </form></details>
        {historyError ? <div className="ferr" role="alert">{historyError}<button className="dbtn s" onClick={() => setRevision(n => n + 1)}>Reintentar historial</button></div> : null}
        {historyLoading ? <p role="status">Cargando movimientos…</p> : history ? <div className="card cash-history">{history.movements.length ? history.movements.map(movement => <div className="cash-movement" key={movement.id}>
          <div><b>{kind[movement.kind] ?? movement.kind}{movement.voidedAt ? ' · Anulado' : ''}</b><small>{financeDateTime(movement.createdAt, zone)} · {movement.category || 'Sin categoría'}</small>{movement.note ? <p>{movement.note}</p> : null}{movement.exchangeRate ? <small>Cotización guardada: ARS {movement.exchangeRate} por USD</small> : null}</div>
          <strong className={movement.amount < 0 ? 'cash-negative' : ''}>{cashMoney(movement.amount, box.currency)}</strong>
          {owner && !movement.voidedAt && !movement.reversalOf && ['INGRESO','EGRESO','AJUSTE','COBRO','DEVOLUCION','TRANSFERENCIA'].includes(movement.kind) ? <div className="cash-row-actions"><button className="dbtn s" aria-label={`Cambiar categoría de ${kind[movement.kind]}`} onClick={() => setMode({ type: 'category', movement, box })}>Categoría</button>{!movement.sourceType ? <button className="dbtn s" aria-label={`Anular ${kind[movement.kind]}`} onClick={() => setMode({ type: 'void', movement, box })}>Anular</button> : <small>Corregir desde el origen</small>}</div> : null}
        </div>) : <p>No hay movimientos en este período.</p>}
          {history.total > 50 ? <div className="cash-actions"><button className="dbtn s" disabled={!filters.offset} onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, (f.offset ?? 0) - 50) }))}>Anterior</button><span>{(filters.offset ?? 0) + 1}–{Math.min((filters.offset ?? 0) + 50, history.total)} de {history.total}</span><button className="dbtn s" disabled={(filters.offset ?? 0) + 50 >= history.total} onClick={() => setFilters(f => ({ ...f, offset: (f.offset ?? 0) + 50 }))}>Siguiente</button></div> : null}
        </div> : null}
        </section> : <p className="cash-help">Podés registrar y contar sin ver el saldo. El dueño administra el permiso «Ver saldo de cajas».</p>}
      </div>
      <aside className="cash-secondary">
        {owner ? <section className="card cash-admin" aria-label="Administración"><header><h3>Administración</h3><small>Solo dueño</small></header>
          {!box.archivedAt ? <>
            {box.session?.status === 'OPEN' && box.session.day === today ? <button className="cash-admin-action" onClick={() => setMode({ type: 'AJUSTE', box })}><b>Ajustar saldo</b><span>Corrige el saldo de {box.name} en {box.currency}. Deja un ajuste en el historial y no modifica resultados.</span><i aria-hidden="true">›</i></button> : null}
            <button className="cash-admin-action" onClick={() => setMode({ type: 'edit', box })}><b>Administrar caja</b><span>Nombre, caja predeterminada y archivo. Conserva moneda, medio e historial.</span><i aria-hidden="true">›</i></button>
          </> : <button className="cash-admin-action" disabled={busy} onClick={() => { void direct({ path: `/${box.id}`, method: 'PATCH', body: { archived: false } }); }}><b>Desarchivar caja</b><span>Recupera {box.name} con el mismo saldo e historial.</span></button>}
        </section> : null}
        {view ? <section className="cash-closings" aria-label="Cierres anteriores">
        <h3 className="cash-section">Cierres anteriores</h3>
        <div className="card cash-previous">{sessions.filter(session => session.status === 'APPROVED').length ? sessions.filter(session => session.status === 'APPROVED').map(session => <details key={session.id}><summary>{financeDate(session.day)} · Cierre aprobado</summary><CountResult session={session} currency={box.currency} timeZone={zone} /></details>) : <p>Todavía no hay cierres aprobados.</p>}</div>
        </section> : null}
      </aside>
    </div> : null}
    </div>
    {mode ? <CashForm key={mode.type + ('box' in mode ? mode.box.id : '')} mode={mode} boxes={cashData?.registers ?? []} busy={busy} onClose={() => { if (!sending.current) setMode(null); }} onSave={save} /> : null}
  </div>;
}

function CountResult({ session, currency, timeZone }: { session: CashSession; currency: string; timeZone: string }) {
  return <>{session.counts?.map((count, index) => <div className="cash-count-result" key={count.id}><small>Conteo {index + 1} · {financeDateTime(count.createdAt, timeZone)}</small><dl><div><dt>Esperado</dt><dd>{cashMoney(count.expected, currency)}</dd></div><div><dt>Contado</dt><dd>{cashMoney(count.counted, currency)}</dd></div><div><dt>Diferencia</dt><dd className={count.difference !== 0 ? 'cash-negative' : ''}>{cashMoney(count.difference, currency)}</dd></div></dl>{count.note ? <p>{count.note}</p> : null}</div>)}</>;
}

function CashForm({ mode, boxes, busy, onClose, onSave }: { mode: Mode; boxes: CashRegister[]; busy: boolean; onClose: () => void; onSave: (command: CashCommand) => Promise<void> }) {
  const blue = useCommissionBlue();
  const box = 'box' in mode ? mode.box : null;
  const [name, setName] = useState(box?.name ?? '');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [method, setMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState(mode.type === 'category' ? mode.movement.category ?? '' : '');
  const [target, setTarget] = useState('');
  const [rate, setRate] = useState(blue.rate ? String(blue.rate) : '');
  const rateEdited = useRef(false);
  useEffect(() => { if (!rateEdited.current && blue.rate) setRate(String(blue.rate)); }, [blue.rate]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [isDefault, setDefault] = useState(box?.isDefault ?? false);
  const requestKey = useRef(crypto.randomUUID());
  const formRef = useRef<HTMLFormElement>(null);
  const total = Object.entries(counts).reduce((sum, [value,count]) => sum + Math.round(Number(value) * 100) * count, 0) / 100;
  const titles = { create: 'Nueva caja', edit: 'Administrar caja', INGRESO: 'Registrar ingreso', EGRESO: 'Registrar egreso', AJUSTE: 'Ajustar saldo', count: 'Contar y cerrar', recount: 'Pedir reconteo', transfer: 'Convertir fondos', void: 'Anular movimiento', category: 'Cambiar categoría' };
  const isMoney = ['INGRESO','EGRESO','AJUSTE','transfer'].includes(mode.type);
  const submit = async () => {
    if (!formRef.current?.reportValidity() || busy) return;
    setError('');
    let command: CashCommand;
    if (mode.type === 'create') command = { path: '', method: 'POST', body: { name, currency, method, opening: Number(amount || 0) } };
    else if (mode.type === 'edit') command = { path: `/${mode.box.id}`, method: 'PATCH', body: { name, ...(isDefault ? { isDefault: true } : {}) } };
    else if (mode.type === 'count') command = { path: `/sessions/${mode.box.session!.id}/count`, method: 'POST', body: { ...(mode.box.method === 'EFECTIVO' ? { denominations: counts } : { counted: Number(amount) }), note } };
    else if (mode.type === 'recount') command = { path: `/sessions/${mode.box.session!.id}/review`, method: 'POST', body: { action: 'RECOUNT', note } };
    else if (mode.type === 'void') command = { path: `/movements/${mode.movement.id}/void`, method: 'POST' };
    else if (mode.type === 'category') command = { path: `/movements/${mode.movement.id}/category`, method: 'PATCH', body: { category: category || null } };
    else if (mode.type === 'transfer') command = { path: '/transfers', method: 'POST', body: { fromId: mode.box.id, toId: target, amount: Number(amount), ...(boxes.find(row => row.id === target)?.currency !== mode.box.currency ? { exchangeRate: Number(rate) } : {}), note, requestKey: requestKey.current } };
    else command = { path: '/movements', method: 'POST', body: { registerId: mode.box.id, kind: mode.type, amount: Number(amount), ...(category ? { category } : {}), note, requestKey: requestKey.current } };
    try { await onSave(command); } catch (err) { setError(toUserMessage(err, 'No se pudo guardar el cambio en caja')); }
  };
  const archive = async () => {
    if (!box || busy) return;
    try { await onSave({ path: `/${box.id}`, method: 'PATCH', body: { archived: true } }); } catch (err) { setError(toUserMessage(err, 'No se pudo archivar la caja')); }
  };
  return <Sheet title={titles[mode.type]} subtitle={box ? `${box.name} · ${box.currency} · ${box.method === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'}` : undefined} busy={busy} onClose={onClose} className="cash-sheet" footer={<>{error ? <div className="ferr" role="alert">{error}</div> : null}<Actions primary={mode.type === 'count' ? 'Guardar conteo' : mode.type === 'void' ? 'Anular movimiento' : 'Guardar'} danger={mode.type === 'void'} busy={busy} onPrimary={() => { void submit(); }} onSecondary={onClose} /></>}>
    <form ref={formRef} className="cash-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      {mode.type === 'create' || mode.type === 'edit' ? <Field label="Nombre"><input required maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></Field> : null}
      {mode.type === 'create' ? <><Field label="Moneda"><DeskSelect label="Moneda de la caja" value={currency} options={[{ value: 'ARS', label: 'ARS · Pesos' },{ value: 'USD', label: 'USD · Dólares' }]} onChange={v => setCurrency(v as 'ARS' | 'USD')} disabled={busy} /></Field><Field label="Medio de pago"><DeskSelect label="Medio de pago de la caja" value={method} options={[{ value: 'EFECTIVO', label: 'Efectivo' },{ value: 'TRANSFERENCIA', label: 'Transferencia' }]} onChange={v => setMethod(v as 'EFECTIVO' | 'TRANSFERENCIA')} disabled={busy} /></Field><Field label="Saldo inicial"><input type="number" inputMode="decimal" min="0" max="100000000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" disabled={busy} /></Field><p className="cash-help">El saldo inicial es el fondo de caja; no cuenta como ingreso.</p></> : null}
      {mode.type === 'edit' ? <><p className="cash-help">{box?.currency} · {box?.method === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'}. La moneda y el medio se conservan para mantener el historial.</p><label className="cash-check"><input type="checkbox" checked={isDefault} onChange={e => setDefault(e.target.checked)} disabled={busy || box?.isDefault} />Caja predeterminada para sus cobros</label><button type="button" className="dbtn s" disabled={busy} onClick={() => { void archive(); }}>Archivar caja</button><p className="cash-help">Al desarchivar vuelve con el mismo saldo. Completá el cierre antes de archivarla.</p></> : null}
      {mode.type === 'INGRESO' || mode.type === 'EGRESO' ? <p className="cash-blind">{mode.type === 'INGRESO' ? 'Suma fondos a' : 'Retira fondos de'} {box!.name} en {box!.currency}. Este movimiento no registra un gasto ni modifica la ganancia neta.</p> : null}
      {mode.type === 'transfer' ? <p className="cash-blind">Origen: {box!.name} · {box!.currency}. Transfiere fondos entre dos cajas abiertas sin modificar resultados.</p> : null}
      {isMoney ? <Field label={mode.type === 'AJUSTE' ? `Ajuste · ${box!.currency} (positivo o negativo)` : `Monto · ${box!.currency}`}><input required type="number" inputMode="decimal" min={mode.type === 'AJUSTE' ? '-100000000' : '0.01'} max="100000000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} disabled={busy} /></Field> : null}
      {mode.type === 'transfer' ? <><Field label="Caja destino"><DeskSelect label="Caja destino" required value={target} options={boxes.filter(row => row.id !== box?.id && !row.archivedAt).map(row => ({ value: row.id, label: `${row.name} · ${row.currency} · ${row.method === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'}` }))} onChange={setTarget} disabled={busy} /></Field>{target && boxes.find(row => row.id === target)?.currency !== box!.currency ? <><Field label="Cotización · ARS por USD"><input required type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" value={rate} onChange={e => { rateEdited.current = true; setRate(e.target.value); }} disabled={busy} /></Field><p className="cash-help">Precargada con dólar blue venta, editable. Se guarda en ambas cajas.</p>{blue.error ? <p className="cash-help">{blue.error}</p> : null}{Number(amount) > 0 && Number(rate) > 0 ? <p className="cash-transfer-total">Destino: {cashMoney(Math.round((box!.currency === 'USD' ? Number(amount) * Number(rate) : Number(amount) / Number(rate)) * 100) / 100, boxes.find(row => row.id === target)!.currency)}</p> : null}</> : <p className="cash-help">Entre cajas de la misma moneda es una transferencia. Ambas deben estar abiertas.</p>}</> : null}
      {mode.type === 'EGRESO' || mode.type === 'INGRESO' || mode.type === 'category' ? <Field label={mode.type === 'EGRESO' ? 'Categoría (obligatoria)' : 'Categoría'}><input required={mode.type === 'EGRESO' || mode.type === 'category' && mode.movement.kind === 'EGRESO'} maxLength={80} placeholder="Ej.: Proveedores, Alquiler, Otros" value={category} onChange={e => setCategory(e.target.value)} disabled={busy} /></Field> : null}
      {mode.type === 'AJUSTE' ? <p className="cash-help">Sumá o restá la corrección. No cuenta como ganancia ni gasto.</p> : null}
      {mode.type === 'count' ? <><p className="cash-blind">Conteo a ciegas: el esperado se muestra después de guardar. Los movimientos se pausan al enviar el conteo.</p>{box!.session?.reviewNote ? <p className="cash-help">Pedido de reconteo: {box!.session.reviewNote}</p> : null}{box!.method === 'EFECTIVO' ? <><div className="cash-denominations">{denominations[box!.currency].map(value => <Field key={value} label={`${box!.currency} ${value.toLocaleString('es-AR')}`}><input aria-label={`Cantidad de ${value}`} type="number" inputMode="numeric" min="0" max="1000000" step="1" placeholder="0" value={counts[String(value)] ?? ''} disabled={busy} onChange={e => setCounts(old => ({ ...old, [String(value)]: Number(e.target.value) }))} /></Field>)}</div><p className="cash-count-total">Total contado: {cashMoney(total, box!.currency)}</p></> : <Field label="Total contado en la cuenta"><input required type="number" inputMode="decimal" min="0" max="100000000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} disabled={busy} /></Field>}<p className="cash-help">Si hay diferencia, necesitás una nota. Podés describir cómo contaste.</p></> : null}
      {isMoney || mode.type === 'count' || mode.type === 'recount' ? <Field label={mode.type === 'recount' ? 'Motivo del reconteo' : mode.type === 'AJUSTE' ? 'Motivo del ajuste' : 'Nota'}><textarea required={mode.type === 'AJUSTE' || mode.type === 'recount'} maxLength={500} rows={3} value={note} onChange={e => setNote(e.target.value)} disabled={busy} /></Field> : null}
      {mode.type === 'void' ? <><p>Se devuelve el dinero con un movimiento de anulación. El original queda en el historial.</p><p className="cash-transfer-total">{cashMoney(mode.movement.amount, mode.box.currency)}</p>{mode.movement.transferGroup ? <p>Se anulan las dos patas de la transferencia o conversión.</p> : null}<p className="cash-help">La caja debe estar abierta hoy. Después podés registrar el movimiento correcto.</p></> : null}
    </form>
  </Sheet>;
}
