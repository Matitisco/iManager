import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, NoticesBar, PhoneRecord, PhoneRecords } from '../section-notice-view';
import { ColumnFilter } from '../ColumnFilter';
import {
  EMPTY_CLIENT_FILTERS,
  clientColumnActive,
  clientFilterKey,
  clientFiltersActive,
  matchesClientColumns,
  type ClientColumnFilters,
} from '../client-column-filters';
import { useMoney, type MoneyApi } from '../exchange';
import { avatarTone, formatInputMoney, formatShortDate, initials, parseAppDate, parseMoney } from '../format';
import { useOperationDraftError } from '../operation-drafts';
import { TablePager, usePagedRows } from '../pager';
import { ImanagerIcon } from '../icons';
import { Actions, ChipRow, Field, IconButton, ImportButton, MenuButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
import type { Client } from '../../types';

const SORTS = ['Deudores', 'Nombre', 'Última compra', 'Gastado'];

function activeClientColumnCount(filters: ClientColumnFilters) {
  return Number(clientColumnActive(filters, 'name'))
    + Number(clientColumnActive(filters, 'dni'))
    + Number(clientColumnActive(filters, 'phone'))
    + Number(clientColumnActive(filters, 'date'))
    + Number(clientColumnActive(filters, 'spent'))
    + Number(clientColumnActive(filters, 'balance'));
}

function sortClients(rows: Client[], sort: string) {
  const copy = [...rows];
  const byName = (left: Client, right: Client) => left.name.localeCompare(right.name, 'es');
  if (sort === 'Nombre') return copy.sort(byName);
  if (sort === 'Última compra') {
    return copy.sort((left, right) => {
      const a = parseAppDate(left.lastPurchaseDate === 'N/A' ? '' : left.lastPurchaseDate)?.getTime();
      const b = parseAppDate(right.lastPurchaseDate === 'N/A' ? '' : right.lastPurchaseDate)?.getTime();
      if (a == null && b == null) return byName(left, right);
      if (a == null) return 1;
      if (b == null) return -1;
      return b - a || byName(left, right);
    });
  }
  if (sort === 'Gastado') return copy.sort((left, right) => right.totalSpent - left.totalSpent || byName(left, right));
  return copy.sort((left, right) => {
    const debt = Number(right.pendingBalance > 0) - Number(left.pendingBalance > 0);
    if (debt) return debt;
    if (left.pendingBalance !== right.pendingBalance) return right.pendingBalance - left.pendingBalance;
    return byName(left, right);
  });
}

export function ClientsScreen() {
  const { clients, operationDrafts = [] } = useAppContext();
  const money = useMoney();
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const notices = useSectionNotices('clients');
  const [onlyNotices, setOnlyNotices] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [sort, setSort] = useState('Deudores');
  const [columns, setColumns] = useState<ClientColumnFilters>(EMPTY_CLIENT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ClientColumnFilters>(EMPTY_CLIENT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const draftError = useOperationDraftError('clients');
  const ownDrafts = operationDrafts.filter((trade) => trade.operationSource === 'clients' && trade.confirmationStatus === 'PENDING');
  const withBalance = clients.filter((client) => client.pendingBalance > 0).length;

  const setColumn = (patch: Partial<ClientColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));
  const setDraft = (patch: Partial<ClientColumnFilters>) => setDraftFilters((current) => ({ ...current, ...patch }));
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matches = filter === 'Todos' || client.pendingBalance > 0;
      const haystack = `${client.name} ${client.phone} ${client.dni} ${client.email}`.toLowerCase();
      return matches && (!q || haystack.includes(q)) && matchesClientColumns(client, columns);
    });
  }, [clients, query, filter, columns]);
  const listed = onlyNotices ? clients.filter((client) => notices.reasonFor(client.id)) : rows;
  const ordered = phone ? sortClients(listed, sort) : listed;
  const page = usePagedRows(ordered, `${query}|${filter}|${clientFilterKey(columns)}|${onlyNotices ? 'notices' : 'all'}|${phone ? sort : ''}`);
  const visibleKey = page.visible.map((client) => client.id).join('|');
  useEffect(() => { notices.markVisible(page.visible.map((client) => client.id)); }, [visibleKey, notices.markVisible]);
  const tags = [...new Set(clients.map((client) => client.tag?.trim()).filter((tag): tag is string => Boolean(tag)))];
  const filterCount = activeClientColumnCount(columns);
  const quietEmpty = clients.length === 0 && !query.trim() && filter === 'Todos' && !clientFiltersActive(columns) && !onlyNotices;
  const openFilters = () => {
    setDraftFilters(columns);
    setFiltersOpen(true);
  };

  return (
    <div className={`dscreen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title="Clientes"
        subtitle={`${clients.length} clientes · ${withBalance} con saldo`}
        back={back}
        tools={(
          <span className="rslot">
            <IconButton label="Filtros" name="filtrar" pressed={filterCount > 0} onClick={openFilters} />
            {filterCount > 0 ? <span className="rbadge">{filterCount}</span> : null}
          </span>
        )}
        desktop={(
          <div className="dright">
            <SearchBox value={query} onChange={setQuery} placeholder="Buscar por nombre, DNI o teléfono" />
            <ImportButton onClick={() => open({ type: 'import', kind: 'cl' })} />
            <button className="dbtn s" type="button" onClick={() => open({ type: 'new-cl' })}>
              <ImanagerIcon name="agregar" size={16} />
              Nuevo cliente
            </button>
          </div>
        )}
      />
      {phone ? <div className="msearch"><SearchBox value={query} onChange={setQuery} placeholder="Buscar por nombre, DNI o teléfono" /></div> : null}
      {draftError ? <div className="ferr">{draftError}</div> : null}
      {ownDrafts.length > 0 ? (
        <div className={`dcard op-drafts${phone ? ' compact' : ''}`}>
          <div><b>Canjes pendientes de confirmar</b><small>Podés retomarlos para completar la venta.</small></div>
          <div className="op-draft-list">{ownDrafts.map((trade) => (
            <button key={trade.id} type="button" onClick={() => open({ type: 'edit-cj', id: trade.id, source: 'clients' })}>
              <span>{trade.clientName || 'Cliente por completar'} · {trade.deviceReceived || 'Equipo recibido'}</span><b>Retomar</b>
            </button>
          ))}</div>
        </div>
      ) : null}
      <div className="dbar">
        <ChipRow
          options={[{ id: 'Todos', label: 'Todos' }, { id: 'saldo', label: 'Con saldo pendiente' }]}
          value={filter}
          onChange={setFilter}
        />
        {phone ? (
          <MenuButton
            testId="clients-sort"
            label={sort === 'Deudores' ? 'Ordenar' : sort}
            options={SORTS}
            value={sort}
            active={sort !== 'Deudores'}
            onChange={setSort}
          />
        ) : null}
      </div>
      <NoticesBar count={notices.count} active={onlyNotices} onToggle={() => setOnlyNotices((current) => !current)} />
      {phone ? (
        listed.length === 0 ? (
          quietEmpty ? <ClientsEmpty onCreate={() => open({ type: 'new-cl' })} /> : <div className="wempty">No hay clientes con ese filtro.</div>
        ) : (
          <>
            {clientFiltersActive(columns) ? <button className="wlink" type="button" onClick={() => setColumns(EMPTY_CLIENT_FILTERS)}>Limpiar filtros</button> : null}
            <PhoneRecords>
              {page.visible.map((client, index) => {
                const reason = notices.reasonFor(client.id);
                const group = client.pendingBalance > 0 ? 'Con saldo' : 'Todos';
                const previous = index > 0 ? page.visible[index - 1] : null;
                const showGroup = filter === 'Todos' && sort === 'Deudores' && (!previous || (previous.pendingBalance > 0) !== (client.pendingBalance > 0));
                return (
                  <Fragment key={client.id}>
                    {showGroup ? <div className="cl-sec">{group}</div> : null}
                    <PhoneRecord
                      reason={reason}
                      testId={`client-row-${client.id}`}
                      onActivate={() => { notices.markVisible([client.id]); open({ type: 'cl', id: client.id }); }}
                      onMenu={(point) => open({ type: 'ctx', kind: 'cl', id: client.id, label: client.name, ...point })}
                    >
                      <ClientCard client={client} money={money} />
                    </PhoneRecord>
                  </Fragment>
                );
              })}
            </PhoneRecords>
            <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
          </>
        )
      ) : (
      <div className="dcard flush">
        <div className="dch pad"><h3>Clientes</h3><span className="mut">{listed.length} de {clients.length}</span>{clientFiltersActive(columns) ? <button className="wlink" type="button" onClick={() => setColumns(EMPTY_CLIENT_FILTERS)}>Limpiar filtros</button> : null}</div>
        <table className="dtable">
            <thead>
              <tr>
                <th><span className="thf">Cliente
                  <ColumnFilter label="cliente" open={openColumn === 'cliente'} onToggle={() => setOpenColumn((current) => current === 'cliente' ? null : 'cliente')} active={clientColumnActive(columns, 'name')} onClear={() => setColumn({ name: '', tags: [] })}>
                    <input aria-label="Contiene" placeholder="Nombre" value={columns.name} onChange={(event) => setColumn({ name: event.target.value })} />
                    {tags.length > 0 ? <div className="opts">{tags.map((tag) => (
                      <label key={tag} className="chk"><input type="checkbox" checked={columns.tags.includes(tag)} onChange={(event) => setColumn({ tags: event.target.checked ? [...columns.tags, tag] : columns.tags.filter((item) => item !== tag) })} />{tag}</label>
                    ))}</div> : null}
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">DNI
                  <ColumnFilter label="dni" open={openColumn === 'dni'} onToggle={() => setOpenColumn((current) => current === 'dni' ? null : 'dni')} active={clientColumnActive(columns, 'dni')} onClear={() => setColumn({ dni: '' })}>
                    <input aria-label="Contiene" placeholder="DNI" value={columns.dni} onChange={(event) => setColumn({ dni: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Teléfono
                  <ColumnFilter label="teléfono" open={openColumn === 'teléfono'} onToggle={() => setOpenColumn((current) => current === 'teléfono' ? null : 'teléfono')} active={clientColumnActive(columns, 'phone')} onClear={() => setColumn({ phone: '' })}>
                    <input aria-label="Contiene" placeholder="Teléfono" value={columns.phone} onChange={(event) => setColumn({ phone: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Última compra
                  <ColumnFilter label="última compra" open={openColumn === 'fecha'} onToggle={() => setOpenColumn((current) => current === 'fecha' ? null : 'fecha')} active={clientColumnActive(columns, 'date')} onClear={() => setColumn({ dateFrom: '', dateTo: '' })}>
                    <div className="range">
                      <label><span>Desde</span><input aria-label="Desde" placeholder="dd/mm/aaaa" value={columns.dateFrom} onChange={(event) => setColumn({ dateFrom: event.target.value })} /></label>
                      <label><span>Hasta</span><input aria-label="Hasta" placeholder="dd/mm/aaaa" value={columns.dateTo} onChange={(event) => setColumn({ dateTo: event.target.value })} /></label>
                    </div>
                  </ColumnFilter>
                </span></th>
                <th className="r"><span className="thf">Gastado
                  <ColumnFilter label="gastado" align="right" open={openColumn === 'gastado'} onToggle={() => setOpenColumn((current) => current === 'gastado' ? null : 'gastado')} active={clientColumnActive(columns, 'spent')} onClear={() => setColumn({ spentMin: '', spentMax: '' })}>
                    <div className="range">
                      <label><span>Mínimo</span><input aria-label="Mínimo" inputMode="numeric" value={columns.spentMin ? formatInputMoney(parseMoney(columns.spentMin)) : ''} onChange={(event) => setColumn({ spentMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                      <label><span>Máximo</span><input aria-label="Máximo" inputMode="numeric" value={columns.spentMax ? formatInputMoney(parseMoney(columns.spentMax)) : ''} onChange={(event) => setColumn({ spentMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                    </div>
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Saldo
                  <ColumnFilter label="saldo" align="right" open={openColumn === 'saldo'} onToggle={() => setOpenColumn((current) => current === 'saldo' ? null : 'saldo')} active={clientColumnActive(columns, 'balance')} onClear={() => setColumn({ balanceMin: '', balanceMax: '' })}>
                    <div className="range">
                      <label><span>Mínimo</span><input aria-label="Mínimo" inputMode="numeric" value={columns.balanceMin ? formatInputMoney(parseMoney(columns.balanceMin)) : ''} onChange={(event) => setColumn({ balanceMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                      <label><span>Máximo</span><input aria-label="Máximo" inputMode="numeric" value={columns.balanceMax ? formatInputMoney(parseMoney(columns.balanceMax)) : ''} onChange={(event) => setColumn({ balanceMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                    </div>
                  </ColumnFilter>
                </span></th>
              </tr>
            </thead>
            <tbody>
              {page.visible.map((client) => (
                <PressTarget
                  key={client.id}
                  as="tr"
                  className={notices.reasonFor(client.id) ? 'novedad' : undefined}
                  testId={`client-row-${client.id}`}
                  onActivate={() => { notices.markVisible([client.id]); open({ type: 'cl', id: client.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'cl', id: client.id, label: client.name, ...point })}
                >
                  <td>
                    <div className="dcell">
                      <div className={`av-c ${avatarTone(client.name)}`}>{initials(client.name)}</div>
                      <div><b>{client.name}{client.tag ? <> <Pill status={client.tag} kind="CLIENT_TAG" /></> : null}</b><small>{client.email || '-'}</small><NoticeTag reason={notices.reasonFor(client.id)} /></div>
                    </div>
                  </td>
                  <td>{client.dni || '-'}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A' ? formatShortDate(client.lastPurchaseDate) : '—'}</td>
                  <td className="r">{money.show(client.totalSpent, client.balanceCurrency)}</td>
                  <td>{client.pendingBalance > 0 ? <span className="spill off">Saldo {money.compact(client.pendingBalance, client.balanceCurrency)}</span> : <span className="spill mid">Sin saldo</span>}</td>
                </PressTarget>
              ))}
            </tbody>
          </table>
        {listed.length === 0 ? <div className="wempty">{clients.length === 0 && !clientFiltersActive(columns) && !onlyNotices ? 'No encontré clientes.' : 'No hay clientes con ese filtro.'}</div> : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      )}
      {phone ? <MobileDock primary="Nuevo cliente" onPrimary={() => open({ type: 'new-cl' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'cl' })} /> : null}
      {filtersOpen ? (
        <Sheet title="Filtros" onClose={() => setFiltersOpen(false)} className="cl-sheet">
          <div className="inv-filters">
            <Field label="Nombre">
              <input aria-label="Nombre" placeholder="Nombre" value={draftFilters.name} onChange={(event) => setDraft({ name: event.target.value })} />
            </Field>
            {tags.length > 0 ? (
              <div className="inv-checks">
                {tags.map((tag) => (
                  <label key={tag} className="chk">
                    <input type="checkbox" checked={draftFilters.tags.includes(tag)} onChange={(event) => setDraft({ tags: event.target.checked ? [...draftFilters.tags, tag] : draftFilters.tags.filter((item) => item !== tag) })} />
                    {tag}
                  </label>
                ))}
              </div>
            ) : null}
            <Field label="DNI">
              <input aria-label="DNI" placeholder="DNI" value={draftFilters.dni} onChange={(event) => setDraft({ dni: event.target.value })} />
            </Field>
            <Field label="Teléfono">
              <input aria-label="Teléfono" placeholder="Teléfono" value={draftFilters.phone} onChange={(event) => setDraft({ phone: event.target.value })} />
            </Field>
            <p className="sec">Última compra</p>
            <div className="inv-range">
              <Field label="Compra desde">
                <input aria-label="Compra desde" placeholder="dd/mm/aaaa" value={draftFilters.dateFrom} onChange={(event) => setDraft({ dateFrom: event.target.value })} />
              </Field>
              <Field label="Compra hasta">
                <input aria-label="Compra hasta" placeholder="dd/mm/aaaa" value={draftFilters.dateTo} onChange={(event) => setDraft({ dateTo: event.target.value })} />
              </Field>
            </div>
            <p className="sec">Gastado · {money.active}</p>
            <div className="inv-range">
              <Field label="Gastado mínimo">
                <input aria-label="Gastado mínimo" inputMode="numeric" value={draftFilters.spentMin ? formatInputMoney(parseMoney(draftFilters.spentMin)) : ''} onChange={(event) => setDraft({ spentMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
              </Field>
              <Field label="Gastado máximo">
                <input aria-label="Gastado máximo" inputMode="numeric" value={draftFilters.spentMax ? formatInputMoney(parseMoney(draftFilters.spentMax)) : ''} onChange={(event) => setDraft({ spentMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
              </Field>
            </div>
            <p className="sec">Saldo · {money.active}</p>
            <div className="inv-range">
              <Field label="Saldo mínimo">
                <input aria-label="Saldo mínimo" inputMode="numeric" value={draftFilters.balanceMin ? formatInputMoney(parseMoney(draftFilters.balanceMin)) : ''} onChange={(event) => setDraft({ balanceMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
              </Field>
              <Field label="Saldo máximo">
                <input aria-label="Saldo máximo" inputMode="numeric" value={draftFilters.balanceMax ? formatInputMoney(parseMoney(draftFilters.balanceMax)) : ''} onChange={(event) => setDraft({ balanceMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
              </Field>
            </div>
          </div>
          <Actions
            secondary="Limpiar filtros"
            onSecondary={() => setDraftFilters(EMPTY_CLIENT_FILTERS)}
            primary="Aplicar filtros"
            onPrimary={() => { setColumns(draftFilters); setFiltersOpen(false); }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

function ClientCard({ client, money }: { client: Client; money: MoneyApi }) {
  const contact = [client.dni ? `DNI ${client.dni}` : '', client.phone].filter(Boolean).join(' · ');
  const bought = client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A';
  return (
    <span className="cl-card">
      <span className="cl-top">
        <span className={`av-c ${avatarTone(client.name)}`}>{initials(client.name)}</span>
        <span className="cl-id">
          <b>{client.name}{client.tag ? <> <Pill status={client.tag} kind="CLIENT_TAG" /></> : null}</b>
          {contact ? <small>{contact}</small> : null}
          {client.email ? <small>{client.email}</small> : null}
        </span>
        <span className="cl-balance">
          {client.pendingBalance > 0
            ? <span className="spill off">Saldo {money.compact(client.pendingBalance, client.balanceCurrency)}</span>
            : <span className="spill mid">Sin saldo</span>}
        </span>
      </span>
      <span className="cl-bot">
        <span><em>Última compra</em><b>{bought ? formatShortDate(client.lastPurchaseDate) : '—'}</b></span>
        <span><em>Total gastado</em><b>{money.show(client.totalSpent, client.balanceCurrency)}</b></span>
      </span>
    </span>
  );
}

function ClientsEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="inv-empty" data-testid="clients-empty">
      <div className="inv-empty-box">
        <div className="inv-empty-mark"><ImanagerIcon name="cliente" size={24} /></div>
        <b>No hay clientes</b>
        <p>Cargá tu primer cliente para empezar tu cartera.</p>
        <button className="dbtn p" type="button" onClick={onCreate}>
          <ImanagerIcon name="agregar" size={16} />
          Nuevo cliente
        </button>
      </div>
      <p className="inv-count">0 resultados</p>
    </div>
  );
}
