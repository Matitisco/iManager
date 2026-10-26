import { isSectionHidden } from '../../config/hiddenSections';
import { useArchivedRows } from '../use-archived-rows';
import { isVoidRow, mergeRecordRows } from '../format';
import { useNavigationState } from '../route-viewport';
import { BulkActions, useBulkScope } from '../bulk-actions';
import { clientNet } from '../client-balance';
import { clientSpendingById, combinedClientSpending } from '../client-spending';
import { ClientSpending } from '../ClientSpending';
import type { StoredAmount } from '../money';
import { suppressLocalNetworkBanner } from '../offline-banner';
import { SelectFiltered, useBulkSelection } from '../bulk-selection';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { reasonWithBalance, usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, PhoneRecord, PhoneRecords } from '../section-notice-view';
import { ColumnFilter, DateRange, MoneyFilterInput, MoneyRange, useColumnMenu } from '../ColumnFilter';
import {
  EMPTY_CLIENT_FILTERS,
  clientColumnActive,
  clientFilterKey,
  clientFiltersActive,
  matchesClientColumns,
  type ClientColumnFilters,
} from '../client-column-filters';
import { useMoney, type MoneyApi } from '../exchange';
import { avatarTone, formatShortDate, initials, parseAppDate } from '../format';
import { useOperationDraftError } from '../operation-drafts';
import { PendingDrafts } from '../pending-drafts';
import { TablePager, usePagedRows } from '../pager';
import { ImanagerIcon } from '../icons';
import { ListSkeleton, listsAreLoading } from '../list-skeleton';
import { Actions, ChipRow, Field, IconButton, ImportButton, MenuButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
import type { Client } from '../../types';
import { fetchArchivedClients } from '../../services/clients-api';
import { rememberArchivedClients } from '../archive-cache';
import { AccountCurrent } from './CurrentAccount';
import { FollowUps } from './FollowUps';

const CLIENT_VIEWS = [{ id: 'lista', label: 'Lista' }, { id: 'cuenta', label: 'Cuenta corriente' }, { id: 'seguimientos', label: 'Seguimientos' }];

const SORTS = ['Deudores', 'Nombre', 'Última compra', 'Gastado'];

function activeClientColumnCount(filters: ClientColumnFilters) {
  return Number(clientColumnActive(filters, 'name'))
    + Number(clientColumnActive(filters, 'dni'))
    + Number(clientColumnActive(filters, 'phone'))
    + Number(clientColumnActive(filters, 'date'))
    + Number(clientColumnActive(filters, 'spent'))
    + Number(clientColumnActive(filters, 'balance'));
}

function sortClients(rows: Client[], sort: string, spent: (client: Client) => number | null) {
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
  if (sort === 'Gastado') return copy.sort((left, right) => {
    const a = spent(left);
    const b = spent(right);
    if (a == null && b == null) return byName(left, right);
    if (a == null) return 1;
    if (b == null) return -1;
    return b - a || byName(left, right);
  });
  return copy.sort((left, right) => {
    const leftNet = clientNet(left);
    const rightNet = clientNet(right);
    const debt = Number(rightNet > 0) - Number(leftNet > 0);
    if (debt) return debt;
    if (leftNet !== rightNet) return rightNet - leftNet;
    return byName(left, right);
  });
}

export function ClientsScreen() {
  const { clients, sales = [], repairOrders = [], deleteClient, operationDrafts = [], listsLoaded } = useAppContext();
  const loadingLists = listsAreLoading(listsLoaded);
  const money = useMoney();
  const spending = useMemo(() => clientSpendingById(sales, repairOrders, money.active), [sales, repairOrders, money.active]);
  const spent = (client: Client) => money.sum(combinedClientSpending(spending.get(client.id) ?? [], client));
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const notices = useSectionNotices('clients');
  const [query, setQuery] = useNavigationState('Clients.query', '');
  const [storedView, setView] = useNavigationState('Clients.view', 'lista');
  const views = CLIENT_VIEWS.filter(item => !isSectionHidden(item.id));
  const view = views.some(item => item.id === storedView) ? storedView : 'lista';
  useEffect(() => { if (storedView !== view) setView(view); }, [storedView, view, setView]);
  const [filter, setFilter] = useNavigationState('Clients.filter', 'Todos');
  const [sort, setSort] = useNavigationState('Clients.sort', 'Deudores');
  const [columns, setColumns] = useNavigationState<ClientColumnFilters>('Clients.columns', EMPTY_CLIENT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ClientColumnFilters>(EMPTY_CLIENT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [archivedMode, setArchivedMode] = useNavigationState('Clients.archivedMode', false);
  const { rows: archivedClients } = useArchivedRows(clients, fetchArchivedClients, rememberArchivedClients);
  const menu = useColumnMenu();
  const draftError = useOperationDraftError('clients');
  const ownDrafts = operationDrafts.filter((trade) => trade.operationSource === 'clients' && trade.confirmationStatus === 'PENDING');

  const clientSource = archivedMode ? archivedClients : mergeRecordRows(clients, archivedClients);
  const noticeFor = (client: Client) => reasonWithBalance(notices.reasonFor(client.id), client.pendingBalance, client.balanceCurrency);

  const setColumn = (patch: Partial<ClientColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));
  const setDraft = (patch: Partial<ClientColumnFilters>) => setDraftFilters((current) => ({ ...current, ...patch }));
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clientSource.filter((client) => {
      const matches = filter === 'Todos' || (archivedMode || !isVoidRow(client)) && clientNet(client) > 0;
      const haystack = `${client.name} ${client.phone} ${client.dni} ${client.email}`.toLowerCase();
      return matches && (!q || haystack.includes(q)) && matchesClientColumns(client, columns, spent(client));
    });
  }, [clientSource, query, filter, columns, archivedMode, spending, money]);
  const listed = rows;
  const ordered = notices.prioritize(phone ? sortClients(listed, sort, spent) : listed);
  const page = usePagedRows(ordered, `${query}|${filter}|${clientFilterKey(columns)}|${notices.key}|${phone ? sort : ''}`, undefined, 'Clients');
  const scope = useBulkScope();
  const selection = useBulkSelection(ordered, scope);
  const tags = [...new Set(clients.map((client) => client.tag?.trim()).filter((tag): tag is string => Boolean(tag)))];
  const filterCount = activeClientColumnCount(columns);
  const quietEmpty = clientSource.length === 0 && !query.trim() && filter === 'Todos' && !clientFiltersActive(columns);
  const openFilters = () => {
    setDraftFilters(columns);
    setFiltersOpen(true);
  };

  return (
    <div className={`dscreen mobile-list-screen cl-clients-screen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title="Clientes"
        back={back}
        tools={view === 'lista' ? (
          <span className="rslot">
            <IconButton label="Filtros" name="filtrar" pressed={filterCount > 0} onClick={openFilters} />
            {filterCount > 0 ? <span className="rbadge">{filterCount}</span> : null}
          </span>
        ) : undefined}
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
      {draftError && !suppressLocalNetworkBanner(draftError) ? <div className="ferr">{draftError}</div> : null}
      <PendingDrafts compact={phone} drafts={ownDrafts} hint="Podés retomarlos para completar la venta." onOpen={(id) => open({ type: 'edit-cj', id, source: 'clients' })} />
      <div className="dbar clients-filters">
        {views.length > 1 ? <div className="acct-views">
          <ChipRow
            options={views}
            value={view}
            onChange={setView}
          />
        </div> : null}
        {view === 'lista' ? <ChipRow
          options={[{ id: 'Todos', label: 'Todos' }, { id: 'saldo', label: 'Con saldo pendiente' }]}
          value={filter}
          onChange={setFilter}
        /> : null}
        {view === 'lista' ? <button type="button" className={`wchip${archivedMode ? ' on' : ''}`} aria-pressed={archivedMode} onClick={() => setArchivedMode((current) => !current)}>Archivados</button> : null}
        {phone && view === 'lista' ? (
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
      {view === 'cuenta' ? <AccountCurrent query={query} /> : null}
      {view === 'seguimientos' ? <FollowUps query={query} /> : null}
      {view === 'lista' ? <BulkActions key={scope} selection={selection} total={ordered.length}
        label={(client) => client.name}
        action={{ label: 'Archivar selección', explanation: 'Se archivarán los clientes seleccionados. Los clientes con una operación activa, una seña activa o saldo a favor no se pueden archivar. Podés restaurarlos.', execute: (client, reason) => deleteClient(client.id, reason), recover: (client) => open({ type: 'cl', id: client.id }) }}
      /> : null}
      {view === 'lista' && phone ? (
        loadingLists ? <ListSkeleton variant="cards" rows={4} testId="clients-loading" /> : listed.length === 0 ? (
          quietEmpty ? <ClientsEmpty onCreate={() => open({ type: 'new-cl' })} /> : <div className="wempty">No hay clientes con ese filtro.</div>
        ) : (
          <>
            {clientFiltersActive(columns) ? <button className="wlink" type="button" onClick={() => setColumns(EMPTY_CLIENT_FILTERS)}>Limpiar filtros</button> : null}
            <PhoneRecords>
              {page.visible.map((client, index) => {
                const reason = noticeFor(client);
                const group = clientNet(client) > 0 ? 'Con saldo' : 'Todos';
                const previous = index > 0 ? page.visible[index - 1] : null;
                const showGroup = filter === 'Todos' && sort === 'Deudores' && (!previous || (clientNet(previous) > 0) !== (clientNet(client) > 0));
                return (
                  <Fragment key={client.id}>
                    {showGroup ? <div className="cl-sec">{group}</div> : null}
                    <PhoneRecord
                      className={isVoidRow(client) ? 'is-void' : undefined}
                      selection={selection.row(client.id, client.name)}
                      reason={reason}
                      testId={`client-row-${client.id}`}
                      onActivate={() => { open({ type: 'cl', id: client.id }); }}
                      onMenu={(point) => open({ type: 'ctx', kind: 'cl', id: client.id, label: client.name, onSelect: () => selection.start(client.id), ...point })}
                    >
                      <ClientCard client={client} money={money} parts={spending.get(client.id) ?? []} />
                    </PhoneRecord>
                  </Fragment>
                );
              })}
            </PhoneRecords>
            <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
          </>
        )
      ) : view === 'lista' ? (
      <div className="dcard flush">
        <div className="dch pad"><h3>Clientes</h3><span className="mut">{listed.length} de {clientSource.length}</span>{clientFiltersActive(columns) ? <button className="wlink" type="button" onClick={() => setColumns(EMPTY_CLIENT_FILTERS)}>Limpiar filtros</button> : null}</div>
        <table className="dtable">
            <thead>
              <tr>
                <th className="bulk-cell"><SelectFiltered selection={selection} total={ordered.length} /></th>
                <th><span className="thf">Cliente
                  <ColumnFilter label="cliente" {...menu('cliente')} active={clientColumnActive(columns, 'name')} onClear={() => setColumn({ name: '', tags: [] })}>
                    <input aria-label="Contiene" placeholder="Nombre" value={columns.name} onChange={(event) => setColumn({ name: event.target.value })} />
                    {tags.length > 0 ? <div className="opts">{tags.map((tag) => (
                      <label key={tag} className="chk"><input type="checkbox" checked={columns.tags.includes(tag)} onChange={(event) => setColumn({ tags: event.target.checked ? [...columns.tags, tag] : columns.tags.filter((item) => item !== tag) })} /><span>{tag}</span></label>
                    ))}</div> : null}
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">DNI
                  <ColumnFilter label="dni" {...menu('dni')} active={clientColumnActive(columns, 'dni')} onClear={() => setColumn({ dni: '' })}>
                    <input aria-label="Contiene" placeholder="DNI" value={columns.dni} onChange={(event) => setColumn({ dni: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Teléfono
                  <ColumnFilter label="teléfono" {...menu('teléfono')} active={clientColumnActive(columns, 'phone')} onClear={() => setColumn({ phone: '' })}>
                    <input aria-label="Contiene" placeholder="Teléfono" value={columns.phone} onChange={(event) => setColumn({ phone: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Última compra
                  <ColumnFilter label="última compra" {...menu('fecha')} active={clientColumnActive(columns, 'date')} onClear={() => setColumn({ dateFrom: '', dateTo: '' })}>
                    <DateRange value={columns} onChange={setColumn} />
                  </ColumnFilter>
                </span></th>
                <th className="r"><span className="thf">Total comprado
                  <ColumnFilter label="gastado" align="right" {...menu('gastado')} active={clientColumnActive(columns, 'spent')} onClear={() => setColumn({ spentMin: '', spentMax: '' })}>
                    <MoneyRange min={columns.spentMin} max={columns.spentMax} onMin={(spentMin) => setColumn({ spentMin })} onMax={(spentMax) => setColumn({ spentMax })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Saldo
                  <ColumnFilter label="saldo" align="right" {...menu('saldo')} active={clientColumnActive(columns, 'balance')} onClear={() => setColumn({ balanceMin: '', balanceMax: '' })}>
                    <MoneyRange min={columns.balanceMin} max={columns.balanceMax} onMin={(balanceMin) => setColumn({ balanceMin })} onMax={(balanceMax) => setColumn({ balanceMax })} />
                  </ColumnFilter>
                </span></th>
              </tr>
            </thead>
            <tbody>
              {page.visible.map((client) => (
                <PressTarget
                  selection={selection.row(client.id, client.name)}
                  key={client.id}
                  as="tr"
                  className={[notices.reasonFor(client.id) ? 'novedad' : '', isVoidRow(client) ? 'is-void' : ''].filter(Boolean).join(' ')}
                  testId={`client-row-${client.id}`}
                  onActivate={() => { open({ type: 'cl', id: client.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'cl', id: client.id, label: client.name, onSelect: () => selection.start(client.id), ...point })}
                >
                  <td>
                    <div className="dcell">
                      <div className={`av-c ${avatarTone(client.name)}`}>{initials(client.name)}</div>
                      <div><b>{client.name}{client.tag ? <> <Pill status={client.tag} kind="CLIENT_TAG" /></> : null}</b><small>{client.email || '-'}</small><NoticeTag reason={noticeFor(client)} /></div>
                    </div>
                  </td>
                  <td>{client.dni || '-'}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A' ? formatShortDate(client.lastPurchaseDate) : '—'}</td>
                  <td className="r"><ClientSpending client={client} parts={spending.get(client.id) ?? []} money={money} compact /></td>
                  <td>{clientNet(client) > 0 ? <span className="spill off">Saldo {money.compact(clientNet(client), client.balanceCurrency)}</span> : clientNet(client) < 0 ? <span className="spill mid">A favor {money.compact(Math.abs(clientNet(client)), client.balanceCurrency)}</span> : <span className="spill mid">Sin saldo</span>}</td>
                </PressTarget>
              ))}
            </tbody>
          </table>
        {loadingLists ? <ListSkeleton variant="rows" rows={6} testId="clients-loading" /> : listed.length === 0 ? <div className="wempty">{clients.length === 0 && !clientFiltersActive(columns) ? 'No encontré clientes.' : 'No hay clientes con ese filtro.'}</div> : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      ) : null}
      {view === 'lista' && phone && !selection.mode ? <MobileDock primary="Nuevo cliente" onPrimary={() => open({ type: 'new-cl' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'cl' })} /> : null}
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
                <MoneyFilterInput label="Gastado mínimo" value={draftFilters.spentMin} onChange={(digits) => setDraft({ spentMin: digits })} />
              </Field>
              <Field label="Gastado máximo">
                <MoneyFilterInput label="Gastado máximo" value={draftFilters.spentMax} onChange={(digits) => setDraft({ spentMax: digits })} />
              </Field>
            </div>
            <p className="sec">Saldo · {money.active}</p>
            <div className="inv-range">
              <Field label="Saldo mínimo">
                <MoneyFilterInput label="Saldo mínimo" value={draftFilters.balanceMin} onChange={(digits) => setDraft({ balanceMin: digits })} />
              </Field>
              <Field label="Saldo máximo">
                <MoneyFilterInput label="Saldo máximo" value={draftFilters.balanceMax} onChange={(digits) => setDraft({ balanceMax: digits })} />
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

function ClientCard({ client, money, parts }: { client: Client; money: MoneyApi; parts: StoredAmount[] }) {
  const contact = [client.dni ? `DNI ${client.dni}` : '', client.phone].filter(Boolean).join(' · ');
  const bought = client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A';
  return (
    <span className="cl-card">
      <span className="cl-top">
        <span className={`av-c ${avatarTone(client.name)}`}>{initials(client.name)}</span>
        <span className="cl-id">
          <b className="cl-name">{client.name}{client.tag ? <> <Pill status={client.tag} kind="CLIENT_TAG" /></> : null}</b>
          <span className="cl-line">
            {contact ? <small className="cl-dni">{contact}</small> : null}
            <span className="cl-balance">
              {clientNet(client) > 0
                ? <span className="spill off">Saldo {money.compact(clientNet(client), client.balanceCurrency)}</span>
                : clientNet(client) < 0
                  ? <span className="spill mid">A favor {money.compact(Math.abs(clientNet(client)), client.balanceCurrency)}</span>
                : <span className="spill mid">Sin saldo</span>}
            </span>
          </span>
          {client.email ? <small className="cl-email">{client.email}</small> : null}
        </span>
      </span>
      <span className="cl-bot">
        <span><em>Última compra</em><b>{bought ? formatShortDate(client.lastPurchaseDate) : '—'}</b></span>
        <span><em>Total comprado</em><ClientSpending client={client} parts={parts} money={money} compact /></span>
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
