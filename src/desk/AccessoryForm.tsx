import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { getFriendlyErrorMessage } from '../lib/utils';
import { ACCESSORY_CATEGORIES, accessoryStatus, movementWhen } from './accessories';
import { formatInputMoney, formatMoney, parseMoney } from './format';
import { Actions, Field, Segs, Sheet, useDesk } from './ui';

type Run = (action: () => Promise<unknown>, ok: string) => void;

export function AccessoryForm({ id, run, busy, error }: { id?: string; run: Run; busy: boolean; error: string | null }) {
  const { accessories = [], addAccessory, updateAccessory, deleteAccessory, loadAccessory } = useAppContext();
  const { close } = useDesk();
  const current = accessories.find((item) => item.id === id);
  const [name, setName] = useState(current?.name ?? '');
  const [category, setCategory] = useState(current?.category || 'Cargadores');
  const [naming, setNaming] = useState(false);
  const [custom, setCustom] = useState('');
  const [compatible, setCompatible] = useState(current?.compatibleWith ?? '');
  const [sku, setSku] = useState(current?.sku ?? '');
  const [cost, setCost] = useState(current ? formatInputMoney(current.cost) : '');
  const [price, setPrice] = useState(current ? formatInputMoney(current.price) : '');
  const [stock, setStock] = useState(current?.stock ?? 0);
  const [minimum, setMinimum] = useState(current?.minStock ?? 3);
  const [bad, setBad] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const categories = [...new Set([...ACCESSORY_CATEGORIES, ...accessories.map((item) => item.category), category])];
  const costValue = parseMoney(cost);
  const priceValue = parseMoney(price);
  const gain = priceValue - costValue;
  const margin = priceValue > 0 ? Math.round((gain / priceValue) * 100) : null;

  useEffect(() => {
    if (!id || typeof loadAccessory !== 'function') return;
    let active = true;
    loadAccessory(id).then((detail) => {
      if (!active) return;
      setName(detail.name);
      setCategory(detail.category);
      setCompatible(detail.compatibleWith);
      setSku(detail.sku);
      setCost(formatInputMoney(detail.cost));
      setPrice(formatInputMoney(detail.price));
      setStock(detail.stock);
      setMinimum(detail.minStock);
    }).catch((err: unknown) => {
      if (active) setLoadError(getFriendlyErrorMessage(err, 'No se pudo cargar el accesorio.'));
    });
    return () => { active = false; };
  }, [id]);

  const save = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Completá este dato';
    if (!category.trim()) next.category = 'Elegí una categoría';
    setBad(next);
    if (Object.keys(next).length || !addAccessory || !updateAccessory) return;
    const payload = {
      name: name.trim(),
      category: category.trim(),
      compatibleWith: compatible.trim(),
      sku: sku.trim(),
      cost: costValue,
      price: priceValue,
      stock,
      minStock: minimum,
    };
    void run(async () => {
      if (current) await updateAccessory(current.id, payload);
      else await addAccessory(payload);
    }, current ? 'Accesorio actualizado' : 'Accesorio cargado');
  };

  return (
    <Sheet title={current ? 'Editar accesorio' : 'Nuevo accesorio'} subtitle={current ? `${current.sku || 'Sin código'} · ${current.category}` : 'Tiene su propio stock, separado de los equipos.'} onClose={close}>
      {error ? <div className="ferr">{error}</div> : null}
      {loadError ? <div className="ferr">{loadError}</div> : null}
      <Field label="Nombre" error={bad.name}><input value={name} placeholder="Ej. Cargador 20W USB-C" onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Categoría" error={bad.category}><span /></Field>
      <Segs options={categories.map((item) => ({ id: item, label: item }))} value={category} onChange={setCategory} onEdit={() => setNaming((value) => !value)} />
      {naming ? (
        <Field label="Nueva categoría">
          <input
            value={custom}
            placeholder="Ej. Auriculares"
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const next = custom.trim();
              if (!next) return;
              setCategory(next.slice(0, 40));
              setCustom('');
              setNaming(false);
            }}
          />
        </Field>
      ) : null}
      <div className="frow">
        <Field label="Compatible con"><input value={compatible} placeholder="Ej. iPhone 12 en adelante" onChange={(event) => setCompatible(event.target.value)} /></Field>
        <Field label="Código / SKU"><input value={sku} placeholder="Opcional" onChange={(event) => setSku(event.target.value)} /></Field>
      </div>
      <div className="frow">
        <Field label="Costo"><input inputMode="numeric" value={cost} placeholder="$ 0" onChange={(event) => setCost(formatInputMoney(parseMoney(event.target.value)))} /></Field>
        <Field label="Precio de venta"><input inputMode="numeric" value={price} placeholder="$ 0" onChange={(event) => setPrice(formatInputMoney(parseMoney(event.target.value)))} /></Field>
      </div>
      <p className="sheet-note">{margin == null ? 'Cargá costo y precio para ver el margen.' : `Margen: ${margin}% · ganás ${formatMoney(gain)} por unidad`}</p>
      <div className="frow">
        <Field label={current ? 'Stock actual' : 'Stock inicial'}>
          <span className="stepper field">
            <button type="button" aria-label="Bajar stock" onClick={() => setStock((value) => Math.max(0, value - 1))}>-</button>
            <b>{stock}</b>
            <button type="button" aria-label="Subir stock" onClick={() => setStock((value) => value + 1)}>+</button>
          </span>
        </Field>
        <Field label={current ? 'Avisarme con' : 'Avisarme con stock de'}>
          <input inputMode="numeric" value={String(minimum)} onChange={(event) => setMinimum(Number(event.target.value.replace(/\D/g, '').slice(0, 6) || 0))} />
        </Field>
      </div>
      {current ? <span className={`spill ${accessoryStatus({ stock, minStock: minimum }) === 'En stock' ? 'ok' : accessoryStatus({ stock, minStock: minimum }) === 'Sin stock' ? 'no' : 'lime'}`}>{accessoryStatus({ stock, minStock: minimum })}</span> : (
        <p className="sheet-note">Cuando queden esas unidades o menos, lo marcamos como stock bajo y te avisamos en Notificaciones.</p>
      )}
      {current?.movements?.length ? (
        <div className="moves">
          <span>Últimos movimientos</span>
          {current.movements.map((move) => (
            <div key={move.id}><b className={move.delta < 0 ? 'down' : 'up'}>{move.delta > 0 ? `+${move.delta}` : move.delta}</b><span>{move.note}</span><small>{movementWhen(move.createdAt)}</small></div>
          ))}
        </div>
      ) : null}
      {current && deleteAccessory ? (
        <div className="sacts three">
          <button className="btn2 ghost-danger" type="button" disabled={busy} onClick={() => run(async () => deleteAccessory(current.id), 'Accesorio eliminado')}>Eliminar</button>
          <button className="btn2 s" type="button" disabled={busy} onClick={close}>Cancelar</button>
          <button className="btn2 p" type="button" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      ) : (
        <Actions busy={busy} primary="Guardar accesorio" onSecondary={close} onPrimary={save} />
      )}
    </Sheet>
  );
}
