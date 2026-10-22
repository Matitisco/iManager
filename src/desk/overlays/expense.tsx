import { archivedExpense } from '../archive-cache';
import { ReasonSheet } from '../ReasonSheet';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { parseMoney, formatInputMoney } from '../format';
import { useMoney } from '../exchange';
import { Actions, Field, Segs, Sheet, useDesk } from '../ui';

const CATEGORIES = ['Alquiler', 'Servicios', 'Sueldos', 'Impuestos', 'Publicidad', 'Flete', 'Insumos', 'Otros'];

export function ExpenseForm({ id }: { id?: string }) {
  const { expenses, saveExpense, archiveExpense, restoreExpense } = useAppContext();
  const money = useMoney();
  const { close, toast } = useDesk();
  const current = expenses?.find((row) => row.id === id) ?? (id ? archivedExpense(id) : undefined);
  const [date, setDate] = useState(current?.date ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(current?.category ?? '');
  const [amount, setAmount] = useState(current ? formatInputMoney(current.amount) : '');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(current?.currency ?? money.active);
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const save = async () => {
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

  const archive = async (reason: string) => {
    if (!id) return;
    setBusy(true);
    try {
      await archiveExpense(id, reason);
      toast('Gasto archivado');
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudo archivar el gasto.'));
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
    <Sheet title={id ? 'Editar gasto' : 'Nuevo gasto'} subtitle="Resta en la ganancia neta. No mueve la caja." onClose={close} busy={busy} footer={
      current?.deletedAt ? (
        <Actions busy={busy} primary="Restaurar" onSecondary={close} onPrimary={() => { void restore(); }} />
      ) : (
        <Actions busy={busy} primary={id ? 'Guardar cambios' : 'Guardar gasto'} onSecondary={close} onPrimary={() => { void save(); }} more={id ? <button className="btn2 danger" type="button" disabled={busy} onClick={() => setConfirm(true)}>Archivar gasto</button> : undefined} />
      )
    }>
      {error ? <div className="ferr">{error}</div> : null}
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
      {confirm ? (
        <ReasonSheet
          title="Archivar gasto"
          note="El gasto queda archivado y deja de restar en la ganancia neta. No se borra."
          ok="Archivar"
          danger
          busy={busy}
          error={error}
          onOk={(reason) => { void archive(reason); }}
          onClose={() => { if (!busy) setConfirm(false); }}
        />
      ) : null}
    </Sheet>
  );
}
