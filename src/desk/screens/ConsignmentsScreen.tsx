import { useEffect, useMemo, useRef, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import type { Consignment } from '../../types';
import type { ConsignmentOptions } from '../../services/consignments-api';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { formatMoney } from '../format';
import { parseEquipmentMoney } from '../equipment-money';
import {
  Actions,
  Field,
  MobileDock,
  ScreenTitle,
  SearchBox,
  Sheet,
  useDesk,
} from '../ui';
import { ListSkeleton } from '../list-skeleton';
import './consignments.css';

function showDebt(rows: Consignment[]) {
  // Keep currencies separate: an agreed price must not move with today's FX rate.
  return (
    (['ARS', 'USD'] as const)
      .map((currency) => ({
        currency,
        amount: rows
          .filter((row) => row.currency === currency)
          .reduce((sum, row) => sum + row.amount * row.cantidad, 0),
      }))
      .filter((row) => row.amount > 0)
      .map((row) => formatMoney(row.amount, row.currency))
      .join(' + ') || formatMoney(0, 'ARS')
  );
}
export function ConsignmentsScreen() {
  const { consignments, consignmentsError, reloadConsignments, appSession } =
    useAppContext();
  const { back } = useDesk();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(false);
  const [payment, setPayment] = useState<Consignment | null>(null);
  const scope = `${appSession?.user.id}:${appSession?.store?.id}`;
  const [initialScope] = useState(scope);
  useEffect(() => {
    if (scope !== initialScope) {
      setForm(false);
      setPayment(null);
    }
  }, [scope, initialScope]);
  const all = consignments?.items ?? [];
  const groups = useMemo(() => {
    const grouped = new Map<string, Consignment[]>();
    for (const row of all)
      grouped.set(row.clientId, [...(grouped.get(row.clientId) ?? []), row]);
    const query = search.trim().toLocaleLowerCase('es');
    return [...grouped.values()].filter((rows) =>
      rows.some((row) =>
        `${row.clientName} ${row.phone ?? ''} ${row.deviceLabel} ${row.imei ?? ''}`
          .toLocaleLowerCase('es')
          .includes(query),
      ),
    );
  }, [consignments, search]);
  const oldest = all.reduce<Consignment | null>(
    (a, b) => (!a || b.deliveredAt < a.deliveredAt ? b : a),
    null,
  );
  const add = (
    <button className="dbtn p" type="button" onClick={() => setForm(true)}>
      Nueva consignación
    </button>
  );
  return (
    <div
      className="dscreen consignments-screen"
      data-testid="consignments-screen"
    >
      <ScreenTitle
        title="Consignaciones"
        back={back}
        navigation={null}
        tools={null}
        desktop={
          <div className="consignment-tools">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Buscar persona o equipo"
            />
            {add}
          </div>
        }
      />
      <div className="consignment-mobile-search">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Buscar persona o equipo"
        />
      </div>
      {consignmentsError ? (
        <div className="ferr" role="alert">
          {consignmentsError}{' '}
          <button type="button" onClick={() => void reloadConsignments()}>
            Reintentar
          </button>
        </div>
      ) : null}
      {!consignments && !consignmentsError ? (
        <ListSkeleton variant="cards" rows={3} />
      ) : null}
      {consignments ? (
        <>
          <div className="consignment-stats">
            <div className="dstat">
              <span>Te deben</span>
              <strong>{showDebt(all)}</strong>
            </div>
            <div className="dstat">
              <span>Equipos afuera</span>
              <strong>{all.reduce((sum, row) => sum + row.cantidad, 0)}</strong>
            </div>
            <div className="dstat">
              <span>Personas</span>
              <strong>{new Set(all.map((row) => row.clientId)).size}</strong>
            </div>
            <div className="dstat">
              <span>Más antigua</span>
              <strong>{oldest ? `${oldest.daysOut} días` : '—'}</strong>
              <small>{oldest?.clientName}</small>
            </div>
          </div>
          {groups.map((rows) => (
            <PersonCard key={rows[0].clientId} rows={rows} onPay={setPayment} />
          ))}
          {!groups.length ? (
            <div className="card consignment-empty">
              <h2>
                {search
                  ? 'No encontramos consignaciones con esa búsqueda.'
                  : 'No hay consignaciones pendientes.'}
              </h2>
              <p>
                Los equipos que entregues van a seguir en tu inventario hasta
                que te los paguen.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
      <MobileDock
        primary="Nueva consignación"
        onPrimary={() => setForm(true)}
      />
      {form ? <ConsignmentForm onClose={() => setForm(false)} /> : null}
      {payment ? (
        <ConsignmentPayment row={payment} onClose={() => setPayment(null)} />
      ) : null}
    </div>
  );
}
function PersonCard({
  rows,
  onPay,
}: {
  rows: Consignment[];
  onPay: (row: Consignment) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const first = rows[0];
  const count = rows.reduce((sum, row) => sum + row.cantidad, 0);
  return (
    <section
      className="card consignment-person"
      aria-label={`Consignaciones de ${first.clientName}`}
    >
      <header>
        <span className="consignment-avatar">
          {first.clientName
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join('')}
        </span>
        <div className="consignment-person-name">
          <h2>{first.clientName}</h2>
          <p>
            {first.phone ? `${first.phone} · ` : ''}
            {count} {count === 1 ? 'equipo' : 'equipos'}
          </p>
        </div>
        <div className="consignment-debt">
          <span>Te debe</span>
          <strong>{showDebt(rows)}</strong>
        </div>
      </header>
      <div className="consignment-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Equipo</th>
              <th>IMEI</th>
              <th>Entregado</th>
              <th className="consignment-amount">Monto</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(expanded ? rows : rows.slice(0, 3)).map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="consignment-device">
                    <span>
                      <Smartphone size={18} />
                    </span>
                    <strong>
                      {row.deviceLabel}
                      {row.cantidad > 1 ? ` × ${row.cantidad}` : ''}
                    </strong>
                  </div>
                </td>
                <td title={row.imei ?? undefined}>
                  {row.imei ? `…${row.imei.slice(-6)}` : '—'}
                </td>
                <td>
                  {new Date(row.deliveredAt).toLocaleDateString('es-AR', {
                    timeZone: 'America/Argentina/Buenos_Aires',
                  })}{' '}
                  · {row.daysOut} días
                </td>
                <td className="consignment-amount">
                  <strong>
                    {formatMoney(row.amount * row.cantidad, row.currency)}
                  </strong>
                </td>
                <td>
                  <button
                    className="dbtn s"
                    type="button"
                    onClick={() => onPay(row)}
                    aria-label={`Marcar pagada ${row.deviceLabel}`}
                  >
                    Marcar pagada
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 3 ? (
        <button
          className="consignment-expand"
          type="button"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Ver menos' : `Ver todas (${rows.length})`}
        </button>
      ) : null}
    </section>
  );
}
export function ConsignmentForm({ onClose }: { onClose: () => void }) {
  const { loadConsignmentOptions, addConsignments, appSession } =
    useAppContext();
  const { toast } = useDesk();
  const [options, setOptions] = useState<ConsignmentOptions | null>(null);
  const [clientId, setClientId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<
    Record<string, { amount: string; currency: 'ARS' | 'USD' }>
  >({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const loadRef = useRef(loadConsignmentOptions);
  loadRef.current = loadConsignmentOptions;
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void loadRef
      .current()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch((cause) => {
        if (active)
          setError(
            getFriendlyErrorMessage(
              cause,
              'No se pudieron cargar los equipos.',
            ),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  async function save() {
    if (saving.current) return;
    const items = Object.entries(selected).map(([productId, row]) => ({
      productId,
      amount: parseEquipmentMoney(row.amount),
      currency: row.currency,
    }));
    if (
      !clientId ||
      !items.length ||
      items.some((row) => !Number.isFinite(row.amount) || row.amount <= 0)
    ) {
      setError(
        'Elegí un cliente, al menos un equipo y un precio positivo por equipo.',
      );
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await addConsignments({ clientId, items });
      toast('Consignación registrada');
      onClose();
    } catch (cause) {
      setError(
        getFriendlyErrorMessage(cause, 'No se pudo guardar la consignación.'),
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Nueva consignación"
      className="consignment-sheet"
      onClose={onClose}
      busy={busy}
      footer={
        <Actions
          primary="Crear consignación"
          onPrimary={() => form.current?.requestSubmit()}
          onSecondary={onClose}
          busy={busy}
          disabled={!options || loading}
        />
      }
    >
      {error ? (
        <div className="ferr" role="alert">
          {error}
          {!options && !loading ? (
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}
      {loading ? <ListSkeleton variant="lines" rows={3} /> : null}
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || loading}>
          <Field label="Cliente">
            <select
              aria-label="Cliente"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              <option value="">Elegí un cliente existente</option>
              {options?.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                  {client.phone ? ` · ${client.phone}` : ''}
                </option>
              ))}
            </select>
          </Field>
          {options && !options.clients.length ? (
            <p>No hay clientes activos. Cargá un cliente para continuar.</p>
          ) : null}
          <p className="consignment-hint">
            Los equipos siguen siendo tuyos y quedan en inventario hasta el
            cobro total.
          </p>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Buscar equipo disponible o IMEI"
          />
          <div className="consignment-options">
            {options?.products
              .filter((item) =>
                `${item.model} ${item.capacity} ${item.imei ?? ''}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((item) => {
                const row = selected[item.id];
                return (
                  <div className="consignment-option" key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!row}
                        onChange={(event) =>
                          setSelected((old) => {
                            const next = { ...old };
                            if (event.target.checked)
                              next[item.id] = {
                                amount: item.price?.toString() ?? '',
                                currency:
                                  item.currency === 'USD' ||
                                  (!item.currency &&
                                    appSession?.store?.currency === 'USD')
                                    ? 'USD'
                                    : 'ARS',
                              };
                            else delete next[item.id];
                            return next;
                          })
                        }
                      />
                      <span>
                        <strong>
                          {item.model} · {item.capacity}
                          {item.cantidad > 1 ? ` × ${item.cantidad}` : ''}
                        </strong>
                        <small>{item.imei || 'Sin IMEI'}</small>
                      </span>
                    </label>
                    {row ? (
                      <div className="consignment-price">
                        <Field label="Precio acordado por equipo">
                          <input
                            aria-label={`Precio de ${item.model}`}
                            inputMode="decimal"
                            value={row.amount}
                            onChange={(event) =>
                              setSelected((old) => ({
                                ...old,
                                [item.id]: {
                                  ...row,
                                  amount: event.target.value,
                                },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Moneda">
                          <select
                            aria-label={`Moneda de ${item.model}`}
                            value={row.currency}
                            onChange={(event) =>
                              setSelected((old) => ({
                                ...old,
                                [item.id]: {
                                  ...row,
                                  currency: event.target.value as 'ARS' | 'USD',
                                },
                              }))
                            }
                          >
                            <option value="ARS">ARS</option>
                            <option value="USD">USD</option>
                          </select>
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
          {options && !options.products.length ? (
            <p>No hay equipos disponibles para consignar.</p>
          ) : null}
          <p className="consignment-hint">
            {Object.keys(selected).length} seleccionados
          </p>
        </fieldset>
      </form>
    </Sheet>
  );
}
function ConsignmentPayment({
  row,
  onClose,
}: {
  row: Consignment;
  onClose: () => void;
}) {
  const { collectConsignment } = useAppContext();
  const { toast } = useDesk();
  const [method, setMethod] = useState('EFECTIVO');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function pay() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await collectConsignment(row.id, method);
      toast('Cobro registrado y venta creada');
      onClose();
    } catch (cause) {
      setError(
        getFriendlyErrorMessage(cause, 'No se pudo registrar el cobro.'),
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Marcar consignación pagada"
      onClose={onClose}
      busy={busy}
      footer={
        <Actions
          primary="Registrar cobro"
          onPrimary={() => void pay()}
          onSecondary={onClose}
          busy={busy}
          busyLabel="Registrando…"
        />
      }
    >
      {error ? (
        <div className="ferr" role="alert">
          {error}
        </div>
      ) : null}
      <p>
        <strong>{row.clientName}</strong> · {row.deviceLabel}
      </p>
      <p className="consignment-payment-total">{showDebt([row])}</p>
      <p className="consignment-hint">
        Al registrar el cobro total se crea la venta y el equipo sale del
        inventario. Sin pagos parciales.
      </p>
      <Field label="Medio de pago">
        <select
          aria-label="Medio de pago"
          disabled={busy}
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        >
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="TARJETA">Tarjeta</option>
        </select>
      </Field>
    </Sheet>
  );
}
