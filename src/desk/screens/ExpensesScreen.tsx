import { rememberArchivedExpenses } from '../archive-cache';
import { useArchivedRows } from '../use-archived-rows';
import { isVoidRow, mergeRecordRows } from '../format';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchExpenses } from '../../services/expenses-api';
import { formatMoney, formatShortDate } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { DeskIcon, MobileDock, ScreenTitle, useDesk } from '../ui';

const loadArchived = (user: Parameters<typeof fetchExpenses>[0]) => fetchExpenses(user, true);

export function ExpensesScreen() {
  const { expenses, expensesLoaded, expenseError, user } = useAppContext();
  const { open, back } = useDesk();
  const [filter, setFilter] = useState('Todos');
  const archived = filter === 'Archivados';
  const { rows: archivedRows, error: archivedError, loading } = useArchivedRows(expenses, loadArchived, rememberArchivedExpenses);
  const activeRows = (expensesLoaded === false ? null : expenses);
  const rows = archived ? (loading ? null : archivedRows) : activeRows == null ? null : filter === 'Activos' ? activeRows : mergeRecordRows(activeRows, archivedRows);
  const error = archived ? archivedError : [ expenseError, filter === 'Todos' ? archivedError : '' ].filter(Boolean).join(' ');
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-expense' })}>Nuevo gasto</button>;

  return (
    <div className="dscreen" data-testid="expenses-screen">
      <ScreenTitle title="Gastos" subtitle="Restan en la ganancia neta. No mueven la caja." back={back} tools={null} desktop={add} />
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          {['Todos', 'Activos', 'Archivados'].map(value => <button key={value} className={`gchip${filter === value ? ' on' : ''}`} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
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
            <button key={row.id} className={`member${isVoidRow(row) ? ' is-void' : ''}`} type="button" data-testid={`expense-${row.id}`} onClick={() => open({ type: 'edit-expense', id: row.id })}>
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
