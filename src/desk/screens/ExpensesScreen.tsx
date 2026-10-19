import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchExpenses, type ExpenseView } from '../../services/expenses-api';
import { formatMoney, formatShortDate } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { DeskIcon, MobileDock, ScreenTitle, useDesk } from '../ui';

export function ExpensesScreen() {
  const { expenses, expensesLoaded, expenseError, user } = useAppContext();
  const { open, back } = useDesk();
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
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-expense' })}>Nuevo gasto</button>;

  return (
    <div className="dscreen" data-testid="expenses-screen">
      <ScreenTitle title="Gastos" subtitle="Restan en la ganancia neta. No mueven la caja." back={back} tools={null} desktop={add} />
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          <button className={`gchip${!archived ? ' on' : ''}`} type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>Activos</button>
          <button className={`gchip${archived ? ' on' : ''}`} type="button" aria-pressed={archived} onClick={() => setArchived(true)}>Archivados</button>
        </div>
      </div>
      {error ? <p className="ferr" role="alert">{error}</p> : null}
      {rows == null ? <ListSkeleton variant="cards" rows={4} testId="expenses-loading" /> : null}
      {rows && rows.length === 0 && !error ? (
        <div className="card team-empty" data-testid="expenses-empty">
          <h2>{archived ? 'No hay gastos archivados.' : 'Todavía no cargaste gastos.'}</h2>
          <p>Alquiler, sueldos y servicios entran acá. La caja sigue aparte.</p>
        </div>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="card ledger-list" data-testid="expenses-list">
          {rows.map((row) => (
            <button key={row.id} className="member" type="button" data-testid={`expense-${row.id}`} onClick={() => open({ type: 'edit-expense', id: row.id })}>
              <span className="ico-row"><DeskIcon name="card" size={18} /></span>
              <span className="info">
                <span className="name">{row.category}</span>
                <span className="role">{formatShortDate(row.date)}{row.notes ? ` · ${row.notes}` : ''}</span>
              </span>
              <span className="rtxt">{formatMoney(row.amount, row.currency)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <MobileDock primary="Nuevo gasto" onPrimary={() => open({ type: 'new-expense' })} />
    </div>
  );
}
