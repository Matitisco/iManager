import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchExpenses, type ExpenseView } from '../../services/expenses-api';
import { financeDate, financeDay, financeMoney, financeMonth } from '../finance-dates';
import { fetchNetProfit, type NetProfitReport } from '../../services/net-profit-api';
import './finance.css';
import { ListSkeleton } from '../list-skeleton';
import { DeskIcon, MobileDock, ScreenTitle, useDesk } from '../ui';

export function ExpensesScreen() {
  const { expenses, expensesLoaded, expenseError, user, appSession } = useAppContext();
  const { open, back, go } = useDesk();
  const [month, setMonth] = useState(() => financeDay(new Date(), appSession?.store?.timezone).slice(0, 7));
  const [category, setCategory] = useState('');
  const period = financeMonth(month);
  const reportScope = `${user?.uid}:${appSession?.store?.id}:${month}`;
  const [reportResult, setReportResult] = useState<{ scope: string; report: NetProfitReport } | null>(null);
  const report = reportResult?.scope === reportScope ? reportResult.report : null;
  const [reportError, setReportError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setReportResult(null); setReportError('');
    if (!user || appSession?.membership?.role !== 'OWNER') return;
    void fetchNetProfit(user, period.from, period.to).then(value => { if (active) setReportResult({ scope: reportScope, report: value }); }).catch((cause: unknown) => {
      if (active) setReportError(getFriendlyErrorMessage(cause, 'No se pudo cargar el resumen mensual.'));
    });
    return () => { active = false; };
  }, [user, reportScope, appSession?.store?.id, appSession?.membership?.role, period.from, period.to, expenses, retry]);
  const [archived, setArchived] = useState(false);
  const [archivedRows, setArchivedRows] = useState<ExpenseView[] | null>(null);
  const [archivedError, setArchivedError] = useState('');

  useEffect(() => {
    if (!archived || !user) return;
    let active = true;
    setArchivedRows(null);
    setArchivedError('');
    void fetchExpenses(user, true).then((rows) => {
      if (active) setArchivedRows(rows);
    }).catch((cause: unknown) => {
      if (active) {
        setArchivedRows([]);
        setArchivedError(getFriendlyErrorMessage(cause, 'No se pudieron cargar los gastos archivados.'));
      }
    });
    return () => { active = false; };
  }, [archived, user]);

  const rows = archived ? archivedRows : (expensesLoaded === false ? null : expenses);
  const error = archived ? archivedError : expenseError;
  const monthRows = rows?.filter(row => row.date >= period.from && row.date <= period.to);
  const categories = [...new Set(monthRows?.map(row => row.category))].sort((a,b) => a.localeCompare(b));
  const visible = monthRows?.filter(row => !category || row.category === category);
  const figure = (value: number | null | undefined) => value == null || report?.blocked ? '—' : financeMoney(value, report?.currency ?? 'ARS');
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-expense' })}>Nuevo gasto</button>;

  return (
    <div className="dscreen finance-screen" data-testid="expenses-screen">
      <ScreenTitle title="Gastos" subtitle={`${period.label} · Gastos y resultados de la tienda.`} back={back} tools={null} desktop={add} />
      <div className="finance-period"><label htmlFor="expense-month">Período mensual</label><input id="expense-month" type="month" value={month} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) { setMonth(event.target.value); setCategory(''); } }} /></div>
      <div className="finance-summary" aria-label={`Resumen mensual · ${period.label}`} aria-busy={!report && !reportError}>
        {[['Gastos del mes', figure(report?.expenses), 'Gastos activos del período'], ['Ganancia bruta', figure(report?.grossProfit), 'Ventas menos costos y devoluciones'], ['Ganancia neta', figure(report?.netProfit), 'Bruta menos gastos del mes']].map(([label, value, help]) => <div className="card finance-stat" key={label}><small>{label}</small><strong>{value}</strong><span>{help}</span></div>)}
      </div>
      {reportError ? <p className="ferr" role="alert">{reportError} <button className="finance-link" onClick={() => setRetry(n => n + 1)}>Reintentar resumen</button></p> : report?.blocked ? <p role="status" className="finance-note">El resumen no está disponible: falta una cotización válida para convertir las monedas.</p> : !report ? <p role="status" className="finance-note">Cargando resumen mensual…</p> : null}
      <div className="finance-note"><p><b>Registrar un gasto reduce la ganancia neta.</b> No registra una salida de dinero de caja. Si el pago salió de una caja, el egreso se registra por separado.</p><button className="finance-link" onClick={() => go('cash')}>Ir a Cajas</button></div>
      <h2 className="finance-section">Gastos de {period.label}</h2>
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          <button className={`gchip${!archived ? ' on' : ''}`} type="button" aria-pressed={!archived} onClick={() => { setArchived(false); setCategory(''); }}>Activos</button>
          <button className={`gchip${archived ? ' on' : ''}`} type="button" aria-pressed={archived} onClick={() => { setArchived(true); setCategory(''); }}>Archivados</button>
        </div>
      </div>
      <div className="finance-categories" role="group" aria-label="Categorías de gastos"><button className={`gchip${!category ? ' on' : ''}`} aria-pressed={!category} onClick={() => setCategory('')}>Todas</button>{categories.map(value => <button className={`gchip${category === value ? ' on' : ''}`} aria-pressed={category === value} key={value} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <p className="finance-list-help">Filtros de la lista: {archived ? 'archivados' : 'activos'} · {category || 'todas las categorías'}. El resumen incluye todos los gastos activos del mes.</p>
      {error ? <p className="ferr" role="alert">{error}</p> : null}
      {rows == null ? <ListSkeleton variant="cards" rows={4} testId="expenses-loading" /> : null}
      {visible && visible.length === 0 && !error ? (
        <div className="card team-empty" data-testid="expenses-empty">
          <h2>{rows?.length === 0 ? (archived ? 'No hay gastos archivados.' : 'Todavía no cargaste gastos.') : 'No hay gastos para estos filtros.'}</h2>
          <p>Alquiler, sueldos y servicios entran acá. La caja sigue aparte.</p>
        </div>
      ) : null}
      {visible && visible.length > 0 ? (
        <div className="card ledger-list" data-testid="expenses-list">
          {visible.map((row) => (
            <button key={row.id} className="member" type="button" data-testid={`expense-${row.id}`} onClick={() => open({ type: 'edit-expense', id: row.id })}>
              <span className="ico-row"><DeskIcon name="card" size={18} /></span>
              <span className="info">
                <span className="name">{row.notes || row.category}</span>
                <span className="role">{row.category} · {financeDate(row.date)}</span>
              </span>
              <span className="rtxt">{financeMoney(row.amount, row.currency)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <MobileDock primary="Nuevo gasto" onPrimary={() => open({ type: 'new-expense' })} />
    </div>
  );
}
