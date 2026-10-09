import { useEffect, useMemo, useState } from 'react';
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
import { useMoney } from '../exchange';
import { avatarTone, formatInputMoney, formatShortDate, initials, parseMoney } from '../format';
import { useOperationDraftError } from '../operation-drafts';
import { TablePager, usePagedRows } from '../pager';
import { ImanagerIcon } from '../icons';
import { ChipRow, IconButton, ImportButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, useDesk } from '../ui';

export function ClientsScreen() {
  const { clients, operationDrafts = [] } = useAppContext();
  const money = useMoney();
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const [searchOpen, setSearchOpen] = useState(false);
  const notices = useSectionNotices('clients');
  const [onlyNotices, setOnlyNotices] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [columns, setColumns] = useState<ClientColumnFilters>(EMPTY_CLIENT_FILTERS);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const draftError = useOperationDraftError('clients');
  const ownDrafts = operationDrafts.filter((trade) => trade.operationSource === 'clients' && trade.confirmationStatus === 'PENDING');
  const withBalance = clients.filter((client) => client.pendingBalance > 0).length;

  const setColumn = (patch: Partial<ClientColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matches = filter === 'Todos' || client.pendingBalance > 0;
      const haystack = `${client.name} ${client.phone} ${client.dni} ${client.email}`.toLowerCase();
      return matches && (!q || haystack.includes(q)) && matchesClientColumns(client, columns);
    });
  }, [clients, query, filter, columns]);
  const listed = onlyNotices ? clients.filter((client) => notices.reasonFor(client.id)) : rows;
  const page = usePagedRows(listed, `${query}|${filter}|${clientFilterKey(columns)}|${onlyNotices ? 'notices' : 'all'}`);
  const visibleKey = page.visible.map((client) => client.id).join('|');
  useEffect(() => { notices.markVisible(page.visible.map((client) => client.id)); }, [visibleKey, notices.markVisible]);
  const tags = [...new Set(clients.map((client) => client.tag?.trim()).filter((tag): tag is string => Boolean(tag)))];

  return (
    <div className={`dscreen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title="Clientes"
        subtitle={`${clients.length} clientes · ${withBalance} con saldo`}
        back={back}
        tools={<IconButton label="Buscar" name="buscar" pressed={searchOpen} onClick={() => setSearchOpen((current) => !current)} />}
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
      {phone && searchOpen ? <div className="msearch"><SearchBox value={query} onChange={setQuery} placeholder="Buscar por nombre, DNI o teléfono" /></div> : null}
      {draftError ? <div className="ferr">{draftError}</div> : null}
      {ownDrafts.length > 0 ? (
        <div className="dcard op-drafts">
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
      </div>
      <NoticesBar count={notices.count} active={onlyNotices} onToggle={() => setOnlyNotices((current) => !current)} />
      <div className="dcard flush">
        <div className="dch pad"><h3>Clientes</h3><span className="mut">{listed.length} de {clients.length}</span>{clientFiltersActive(columns) ? <button className="wlink" type="button" onClick={() => setColumns(EMPTY_CLIENT_FILTERS)}>Limpiar filtros</button> : null}</div>
        {phone ? (
          <PhoneRecords>
            {page.visible.map((client) => {
              const reason = notices.reasonFor(client.id);
              return (
                <PhoneRecord
                  key={client.id}
                  reason={reason}
                  onActivate={() => { notices.markVisible([client.id]); open({ type: 'cl', id: client.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'cl', id: client.id, label: client.name, ...point })}
                >
                  <b>{client.name}</b>
                  <small>{[client.phone, client.pendingBalance > 0 ? money.show(client.pendingBalance, client.balanceCurrency) : 'Sin saldo'].filter(Boolean).join(' · ')}</small>
                </PhoneRecord>
              );
            })}
          </PhoneRecords>
        ) : (
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
        )}
        {listed.length === 0 ? <div className="wempty">{clients.length === 0 && !clientFiltersActive(columns) && !onlyNotices ? 'No encontré clientes.' : 'No hay clientes con ese filtro.'}</div> : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      {phone ? <MobileDock primary="Nuevo cliente" onPrimary={() => open({ type: 'new-cl' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'cl' })} /> : null}
    </div>
  );
}
