import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { parseMoney, formatInputMoney } from '../format';
import { useMoney } from '../exchange';
import { fetchExpenses, type ExpenseView } from '../../services/expenses-api';
import { financeDay, financeMoney } from '../finance-dates';
import '../screens/finance.css';
import { Actions, Dialog, Field, Segs, Sheet, useDesk } from '../ui';

const CATEGORIES = ['Alquiler', 'Servicios', 'Sueldos', 'Impuestos', 'Publicidad', 'Flete', 'Insumos', 'Otros'];

export function ExpenseForm({ id }: { id?: string }) {
  const { expenses, saveExpense, archiveExpense, restoreExpense, user, appSession } = useAppContext();
  const money = useMoney();
  const { close, toast } = useDesk();
  const activeExpense = expenses?.find((row) => row.id === id);
  const [archivedExpense, setArchivedExpense] = useState<ExpenseView | null>(null);
  const current = activeExpense ?? archivedExpense;
  const [date, setDate] = useState(current?.date ?? financeDay(new Date(), appSession?.store?.timezone));
  const [category, setCategory] = useState(current?.category ?? '');
  const [amount, setAmount] = useState(current ? formatInputMoney(current.amount) : '');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(current?.currency ?? money.active);
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const [resolved, setResolved] = useState(!id || Boolean(activeExpense));
  const hydrated = useRef(activeExpense?.id);
  useEffect(() => {
    if (!id || hydrated.current === id) return;
    let active = true;
    const hydrate = (row: ExpenseView) => {
      hydrated.current = row.id;
      setArchivedExpense(row); setDate(row.date); setCategory(row.category); setAmount(formatInputMoney(row.amount)); setCurrency(row.currency); setNotes(row.notes ?? ''); setResolved(true); setError('');
    };
    if (activeExpense) { hydrate(activeExpense); return; }
    if (!user) return;
    setResolved(false);
    void fetchExpenses(user, true).then(rows => {
      if (!active) return;
      const row = rows.find(value => value.id === id);
      if (!row) { setError('No se encontró el gasto. Volvé a abrirlo desde la lista.'); return; }
      hydrate(row);
    }).catch((cause: unknown) => { if (active) setError(getFriendlyErrorMessage(cause, 'No se pudo abrir el gasto archivado.')); });
    return () => { active = false; };
  }, [id, activeExpense, user]);

  const save = async () => {
    if (busy || !resolved) return;
    const next: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = 'Elegí una fecha.';
    if (!category.trim()) next.category = 'Completá la categoría.';
    if (!parseMoney(amount)) next.amount = 'El monto tiene que ser mayor a cero.';
    setBad(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError('');
    try {
      await saveExpense({
        date,
        category: category.trim(),
        amount: parseMoney(amount),
        currency,
        exchangeRate: money.rate,
        notes,
      }, id);
      toast(id ? 'Gasto actualizado' : 'Gasto cargado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo guardar el gasto.'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await archiveExpense(id);
      toast('Gasto archivado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo archivar el gasto.'));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await restoreExpense(id);
      toast('Gasto restaurado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo restaurar el gasto.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet wide className="finance-sheet expense-sheet" title={id ? 'Editar gasto' : 'Nuevo gasto'} subtitle="Se registra en resultados. El dinero de caja se administra por separado." onClose={close} busy={busy} footer={
      !resolved ? <Actions busy={busy} primary="Volver a Gastos" onSecondary={close} onPrimary={close} /> : current?.deletedAt ? (
        <Actions busy={busy} primary="Restaurar" onSecondary={close} onPrimary={() => { void restore(); }} />
      ) : (
        <Actions busy={busy} primary={id ? 'Guardar cambios' : 'Guardar gasto'} onSecondary={close} onPrimary={() => { void save(); }} more={id ? <button className="btn2 danger" type="button" disabled={busy} onClick={() => setConfirm(true)}>Archivar gasto</button> : undefined} />
      )
    }>
      {error ? <div className="ferr" role="alert">{error}</div> : null}
      {!resolved && !error ? <p role="status">Cargando gasto…</p> : null}
      <div className="finance-columns"><fieldset className="finance-fields" disabled={busy || !resolved || Boolean(current?.deletedAt)}>
      {current?.deletedAt ? <p className="archive-note">Archivado. Ya no resta en la ganancia neta.</p> : null}
      <Field label="Fecha" error={bad.date}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      <Field label="Categoría" error={bad.category}>
        <input list="expense-categories" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ej. Alquiler" />
      </Field>
      <datalist id="expense-categories">{CATEGORIES.map((item) => <option key={item} value={item} />)}</datalist>
      <Field label="Monto" error={bad.amount}><input inputMode="decimal" value={amount} onChange={(event) => setAmount(formatInputMoney(parseMoney(event.target.value)) || event.target.value.replace(/[^\d.,]/g, ''))} placeholder="$ 0" /></Field>
      <Field label="Moneda"><span /></Field>
      <Segs options={[{ id: 'ARS', label: 'Pesos' }, { id: 'USD', label: 'Dólares' }]} value={currency} onChange={(value) => setCurrency(value === 'USD' ? 'USD' : 'ARS')} />
      <Field label="Notas"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" /></Field>
      </fieldset><aside className="finance-impact"><h4>Qué cambia</h4><dl><div><dt>Ganancia neta</dt><dd>{current?.deletedAt ? 'No incluye este gasto archivado' : parseMoney(amount) > 0 ? `Se reduce por ${financeMoney(parseMoney(amount), currency)}` : 'Se reduce por el importe del gasto'}</dd></div><div><dt>Caja</dt><dd>No cambia</dd></div></dl><p>Guardar el gasto no registra una salida de dinero. Si el pago salió de una caja, registrá el egreso por separado en Cajas.</p>{id && !current?.deletedAt ? <p>Al editar, el importe actualizado reemplaza al anterior en resultados.</p> : null}</aside></div>
      {confirm ? (
        <Dialog
          title="Archivar gasto"
          text="El gasto queda archivado y deja de restar en la ganancia neta. No se borra."
          ok="Archivar"
          danger
          busy={busy}
          onOk={() => { void archive(); }}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </Sheet>
  );
}
