import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, NoticesBar, PhoneRecord } from '../section-notice-view';
import { useCatalogs } from '../catalog';
import { ColumnFilter } from '../ColumnFilter';
import { useMoney } from '../exchange';
import { formatInputMoney, formatShortDate, isInProgressTrade, parseAppDate, parseMoney, statusLabel, tradeClientLabel, tradeCode } from '../format';
import { qualityDetail, tradeQuality } from '../quality';
import { ImanagerIcon } from '../icons';
import { useOperationDraftError } from '../operation-drafts';
import { TablePager, usePagedRows } from '../pager';
import {
  EMPTY_TRADE_FILTERS,
  matchesTradeColumns,
  tradeColumnActive,
  tradeFilterKey,
  tradeFiltersActive,
  type TradeColumnFilters,
} from '../trade-column-filters';
import { Actions, ChipRow, DeskCta, Field, IconButton, ImportButton, MenuButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
import type { TradeIn } from '../../types';

const DEFAULT_STATUSES = [
  { id: 'PENDIENTE', label: 'Pendiente' },
  { id: 'PERITAJE TÉC.', label: 'Peritaje téc.' },
  { id: 'EN REVISIÓN', label: 'En revisión' },
  { id: 'APROBADO', label: 'Aprobado' },
  { id: 'LISTO', label: 'Completado' },
  { id: 'RECHAZADO', label: 'Rechazado' },
];

function activeTradeColumnCount(filters: TradeColumnFilters) {
  return Number(tradeColumnActive(filters, 'code'))
    + Number(tradeColumnActive(filters, 'date'))
    + Number(tradeColumnActive(filters, 'client'))
    + Number(tradeColumnActive(filters, 'received'))
    + Number(tradeColumnActive(filters, 'given'))
    + Number(tradeColumnActive(filters, 'value'));
}

function moneyDraft(value: string) {
  return value ? formatInputMoney(parseMoney(value)) : '';
}

export function TradeInsScreen() {
  const { tradeIns, clients, operationDrafts = [] } = useAppContext();
  const money = useMoney();
  const catalogs = useCatalogs();
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const [searchOpen, setSearchOpen] = useState(false);
  const notices = useSectionNotices('tradeins');
  const [onlyNotices, setOnlyNotices] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [sort, setSort] = useState('Recientes');
  const [columns, setColumns] = useState<TradeColumnFilters>(EMPTY_TRADE_FILTERS);
  const [draftFilters, setDraftFilters] = useState<TradeColumnFilters>(EMPTY_TRADE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const draftError = useOperationDraftError('tradeins');
  const ownDrafts = operationDrafts.filter((trade) => trade.confirmationStatus === 'PENDING');
  const openCount = tradeIns.filter((item) => isInProgressTrade(item.status)).length;

  const setColumn = (patch: Partial<TradeColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));
  const setDraft = (patch: Partial<TradeColumnFilters>) => setDraftFilters((current) => ({ ...current, ...patch }));
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const direction = sort === 'Recientes' ? -1 : 1;
    return tradeIns.filter((item) => {
      const name = tradeClientLabel(item, clients);
      const code = tradeCode(tradeIns, item.id);
      const haystack = `${name} ${item.clientName ?? ''} ${item.deviceReceived} ${item.deviceReceivedImei} ${item.deviceGiven} ${code}`.toLowerCase();
      if (filter !== 'Todos' && item.status !== filter) return false;
      if (q && !haystack.includes(q)) return false;
      return matchesTradeColumns(item, columns, { code, client: name });
    }).sort((left, right) => {
      const a = parseAppDate(left.date)?.getTime();
      const b = parseAppDate(right.date)?.getTime();
      if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1;
      return direction * (a - b) || direction * ((left.tradeNumber ?? 0) - (right.tradeNumber ?? 0));
    });
  }, [tradeIns, clients, query, filter, columns, sort]);
  const listed = onlyNotices ? tradeIns.filter((item) => notices.reasonFor(item.id)) : rows;
  const quiet = !query.trim() && filter === 'Todos' && !tradeFiltersActive(columns) && !onlyNotices;
  const page = usePagedRows(listed, `${query}|${filter}|${sort}|${tradeFilterKey(columns)}|${onlyNotices ? 'notices' : 'all'}`);
  const visibleKey = page.visible.map((item) => item.id).join('|');
  useEffect(() => { notices.markVisible(page.visible.map((item) => item.id)); }, [visibleKey, notices.markVisible]);

  const statuses = useMemo(() => {
    const known = catalogs?.ready
      ? catalogs.options.filter((option) => option.kind === 'TRADE_IN_STATUS').map((option) => ({ id: option.value, label: option.label }))
      : DEFAULT_STATUSES;
    const extra = [...new Set(tradeIns.map((item) => item.status))].filter((status) => !known.some((item) => item.id === status));
    return [...known, ...extra.map((id) => ({ id, label: statusLabel(id) || 'Sin estado' }))];
  }, [catalogs?.ready, catalogs?.options, tradeIns]);
  const statusOptions = [{ id: 'Todos', label: 'Todos' }, ...statuses];
  const filterCount = activeTradeColumnCount(columns);
  const openFilters = () => {
    setDraftFilters(columns);
    setFiltersOpen(true);
  };
  const clearColumns = () => setColumns(EMPTY_TRADE_FILTERS);
  const emptyCopy = tradeIns.length === 0 ? 'No encontré canjes.' : 'No hay canjes con ese filtro.';

  return (
    <div className={`dscreen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title="Canjes"
        subtitle={`${tradeIns.length} canjes · ${openCount} en curso`}
        back={back}
        tools={(
          <>
            <IconButton label="Buscar" name="buscar" pressed={searchOpen} onClick={() => setSearchOpen((current) => !current)} />
            <span className="rslot">
              <IconButton label="Filtros" name="filtrar" pressed={filterCount > 0} onClick={openFilters} />
              {filterCount > 0 ? <span className="rbadge">{filterCount}</span> : null}
            </span>
          </>
        )}
        desktop={(
          <div className="dright">
            <SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, equipo, IMEI o número" />
            <ImportButton onClick={() => open({ type: 'import', kind: 'cj' })} />
            <DeskCta onClick={() => open({ type: 'new-cj' })}>Nuevo canje</DeskCta>
          </div>
        )}
      />
      {phone && searchOpen ? <div className="msearch"><SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, equipo, IMEI o número" /></div> : null}
      {draftError ? <div className="ferr">{draftError}</div> : null}
      {ownDrafts.length > 0 ? (
        <div className={`dcard op-drafts${phone ? ' compact' : ''}`}>
          <div><b>Canjes pendientes de confirmar</b><small>Podés retomarlos para completar la venta y el equipo entregado.</small></div>
          <div className="op-draft-list">{ownDrafts.map((trade) => (
            <button key={trade.id} type="button" onClick={() => open({ type: 'edit-cj', id: trade.id, source: 'tradeins' })}>
              <span>{trade.clientName || 'Cliente por completar'} · {trade.deviceReceived || 'Equipo recibido'}</span><b>Retomar</b>
            </button>
          ))}</div>
        </div>
      ) : null}
      <div className="dbar">
        <ChipRow
          options={statusOptions}
          value={filter}
          onChange={setFilter}
        />
        <MenuButton label={sort} options={['Recientes', 'Antiguos']} value={sort} onChange={setSort} />
      </div>
      <NoticesBar count={notices.count} active={onlyNotices} onToggle={() => setOnlyNotices((current) => !current)} />
      {phone ? (
        <>
          {!quiet && tradeIns.length > 0 ? (
            <div className="sale-sec"><span>Canjes</span><span>{listed.length} de {tradeIns.length}</span></div>
          ) : null}
          {tradeFiltersActive(columns) ? <button className="wlink" type="button" onClick={clearColumns}>Limpiar filtros</button> : null}
          {listed.length === 0 ? (
            quiet ? <TradeEmpty onCreate={() => open({ type: 'new-cj' })} /> : <div className="wempty">{emptyCopy}</div>
          ) : (
            <>
              <div className="sale-line" data-testid="tradeins-timeline">
                {page.visible.map((item) => {
                  const reason = notices.reasonFor(item.id);
                  const tone = item.confirmationStatus === 'CANCELLED' || item.status === 'RECHAZADO'
                    ? ' cancelled'
                    : item.confirmationStatus === 'PENDING' || isInProgressTrade(item.status)
                      ? ' pending'
                      : '';
                  return (
                    <div key={item.id} className={`sale-node${tone}`}>
                      <PhoneRecord
                        reason={reason}
                        onActivate={() => { notices.markVisible([item.id]); open({ type: 'cj', id: item.id }); }}
                        onMenu={(point) => open({ type: 'ctx', kind: 'cj', id: item.id, label: `${tradeCode(tradeIns, item.id)} · ${tradeClientLabel(item, clients)}`, ...point })}
                      >
                        <TradeCard item={item} code={tradeCode(tradeIns, item.id)} client={tradeClientLabel(item, clients)} take={money.show(item.takeValue, item.currency)} difference={money.show(item.differencePaid, item.currency)} />
                      </PhoneRecord>
                    </div>
                  );
                })}
              </div>
              <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
            </>
          )}
        </>
      ) : (
      <div className="dcard flush">
        <div className="dch pad"><h3>Canjes</h3><span className="mut">{listed.length} de {tradeIns.length}</span>{tradeFiltersActive(columns) ? <button className="wlink" type="button" onClick={clearColumns}>Limpiar filtros</button> : null}</div>
        <div className="dtable-scroll">
          <table className="dtable trade-table" aria-label="Canjes">
            <thead>
              <tr>
                <th><span className="thf">Canje
                  <ColumnFilter label="canje" open={openColumn === 'canje'} onToggle={() => setOpenColumn((current) => current === 'canje' ? null : 'canje')} active={tradeColumnActive(columns, 'code')} onClear={() => setColumn({ code: '' })}>
                    <input aria-label="Contiene" placeholder="Número" value={columns.code} onChange={(event) => setColumn({ code: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Fecha
                  <ColumnFilter label="fecha" open={openColumn === 'fecha'} onToggle={() => setOpenColumn((current) => current === 'fecha' ? null : 'fecha')} active={tradeColumnActive(columns, 'date')} onClear={() => setColumn({ dateFrom: '', dateTo: '' })}>
                    <div className="range">
                      <label><span>Desde</span><input aria-label="Desde" placeholder="dd/mm/aaaa" value={columns.dateFrom} onChange={(event) => setColumn({ dateFrom: event.target.value })} /></label>
                      <label><span>Hasta</span><input aria-label="Hasta" placeholder="dd/mm/aaaa" value={columns.dateTo} onChange={(event) => setColumn({ dateTo: event.target.value })} /></label>
                    </div>
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Cliente
                  <ColumnFilter label="cliente" open={openColumn === 'cliente'} onToggle={() => setOpenColumn((current) => current === 'cliente' ? null : 'cliente')} active={tradeColumnActive(columns, 'client')} onClear={() => setColumn({ client: '' })}>
                    <input aria-label="Contiene" placeholder="Nombre" value={columns.client} onChange={(event) => setColumn({ client: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Recibido
                  <ColumnFilter label="recibido" open={openColumn === 'recibido'} onToggle={() => setOpenColumn((current) => current === 'recibido' ? null : 'recibido')} active={tradeColumnActive(columns, 'received')} onClear={() => setColumn({ received: '' })}>
                    <input aria-label="Contiene" placeholder="Equipo o IMEI" value={columns.received} onChange={(event) => setColumn({ received: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Entregado
                  <ColumnFilter label="entregado" open={openColumn === 'entregado'} onToggle={() => setOpenColumn((current) => current === 'entregado' ? null : 'entregado')} active={tradeColumnActive(columns, 'given')} onClear={() => setColumn({ given: '' })}>
                    <input aria-label="Contiene" placeholder="Equipo" value={columns.given} onChange={(event) => setColumn({ given: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th className="r"><span className="thf">Valor / diferencia
                  <ColumnFilter label="valor" align="right" open={openColumn === 'valor'} onToggle={() => setOpenColumn((current) => current === 'valor' ? null : 'valor')} active={tradeColumnActive(columns, 'value')} onClear={() => setColumn({ valueMin: '', valueMax: '', differenceMin: '', differenceMax: '' })}>
                    <div className="range">
                      <label><span>Valor mín.</span><input aria-label="Valor mínimo" inputMode="numeric" value={moneyDraft(columns.valueMin)} onChange={(event) => setColumn({ valueMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                      <label><span>Valor máx.</span><input aria-label="Valor máximo" inputMode="numeric" value={moneyDraft(columns.valueMax)} onChange={(event) => setColumn({ valueMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                    </div>
                    <div className="range">
                      <label><span>Dif. mín.</span><input aria-label="Diferencia mínima" inputMode="numeric" value={moneyDraft(columns.differenceMin)} onChange={(event) => setColumn({ differenceMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                      <label><span>Dif. máx.</span><input aria-label="Diferencia máxima" inputMode="numeric" value={moneyDraft(columns.differenceMax)} onChange={(event) => setColumn({ differenceMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                    </div>
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Estado
                  <ColumnFilter label="estado" align="right" open={openColumn === 'estado'} onToggle={() => setOpenColumn((current) => current === 'estado' ? null : 'estado')} active={filter !== 'Todos'} onClear={() => setFilter('Todos')}>
                    <div className="opts">
                      {statusOptions.map((option) => (
                        <button key={option.id} className={`opt${filter === option.id ? ' on' : ''}`} type="button" onClick={() => setFilter(option.id)}>{option.label}</button>
                      ))}
                    </div>
                  </ColumnFilter>
                </span></th>
              </tr>
            </thead>
            <tbody>
              {page.visible.map((item) => (
                <PressTarget
                  key={item.id}
                  as="tr"
                  className={notices.reasonFor(item.id) ? 'novedad' : undefined}
                  onActivate={() => { notices.markVisible([item.id]); open({ type: 'cj', id: item.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'cj', id: item.id, label: `${tradeCode(tradeIns, item.id)} · ${tradeClientLabel(item, clients)}`, ...point })}
                >
                  <td className="trade-nowrap"><b>#{tradeCode(tradeIns, item.id)}</b><NoticeTag reason={notices.reasonFor(item.id)} /></td>
                  <td className="trade-nowrap">{formatShortDate(item.date)}</td>
                  <td>{tradeClientLabel(item, clients)}</td>
                  <td className="trade-device"><b>{item.deviceReceived || '—'}</b>{tradeQuality(item.grade) ? <small>Calidad {qualityDetail(tradeQuality(item.grade))}</small> : null}{item.deviceReceivedImei ? <small>{item.deviceReceivedImei}</small> : null}</td>
                  <td className="trade-device">{item.deviceGiven || '—'}</td>
                  <td className="r trade-nowrap"><b>{money.show(item.takeValue, item.currency)}</b><small>Dif. {money.show(item.differencePaid, item.currency)}</small></td>
                  <td>
                    {item.status ? <Pill status={item.status} kind="TRADE_IN_STATUS" /> : '—'}
                    {item.confirmationStatus === 'PENDING' ? <small className="trade-confirmation pending">Pendiente de confirmación</small> : null}
                    {item.confirmationStatus === 'CONFIRMED' ? <small className="trade-confirmation">Canje confirmado</small> : null}
                    {item.confirmationStatus === 'CANCELLED' ? <small className="trade-confirmation cancelled">Operación cancelada</small> : null}
                  </td>
                </PressTarget>
              ))}
            </tbody>
          </table>
        </div>
        {listed.length === 0 ? <div className="wempty">{emptyCopy}</div> : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      )}
      {phone ? <MobileDock primary="Nuevo canje" onPrimary={() => open({ type: 'new-cj' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'cj' })} /> : null}
      {filtersOpen ? (
        <Sheet title="Filtros" onClose={() => setFiltersOpen(false)} className="cj-sheet">
          <div className="inv-filters">
            <Field label="Canje">
              <input aria-label="Canje" placeholder="Número" value={draftFilters.code} onChange={(event) => setDraft({ code: event.target.value })} />
            </Field>
            <p className="sec">Fecha</p>
            <div className="inv-range">
              <Field label="Desde">
                <input aria-label="Desde" placeholder="dd/mm/aaaa" value={draftFilters.dateFrom} onChange={(event) => setDraft({ dateFrom: event.target.value })} />
              </Field>
              <Field label="Hasta">
                <input aria-label="Hasta" placeholder="dd/mm/aaaa" value={draftFilters.dateTo} onChange={(event) => setDraft({ dateTo: event.target.value })} />
              </Field>
            </div>
            <Field label="Cliente">
              <input aria-label="Cliente" placeholder="Nombre" value={draftFilters.client} onChange={(event) => setDraft({ client: event.target.value })} />
            </Field>
            <Field label="Recibido">
              <input aria-label="Recibido" placeholder="Equipo o IMEI" value={draftFilters.received} onChange={(event) => setDraft({ received: event.target.value })} />
            </Field>
            <Field label="Entregado">
              <input aria-label="Entregado" placeholder="Equipo" value={draftFilters.given} onChange={(event) => setDraft({ given: event.target.value })} />
            </Field>
            <p className="sec">Valor tomado · {money.active}</p>
            <div className="inv-range">
              <Field label="Valor mínimo">
                <input aria-label="Valor mínimo" inputMode="numeric" value={moneyDraft(draftFilters.valueMin)} onChange={(event) => setDraft({ valueMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
              </Field>
              <Field label="Valor máximo">
                <input aria-label="Valor máximo" inputMode="numeric" value={moneyDraft(draftFilters.valueMax)} onChange={(event) => setDraft({ valueMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
              </Field>
            </div>
            <p className="sec">Diferencia · {money.active}</p>
            <div className="inv-range">
              <Field label="Diferencia mínima">
                <input aria-label="Diferencia mínima" inputMode="numeric" value={moneyDraft(draftFilters.differenceMin)} onChange={(event) => setDraft({ differenceMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
              </Field>
              <Field label="Diferencia máxima">
                <input aria-label="Diferencia máxima" inputMode="numeric" value={moneyDraft(draftFilters.differenceMax)} onChange={(event) => setDraft({ differenceMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
              </Field>
            </div>
          </div>
          <Actions
            secondary="Limpiar filtros"
            onSecondary={() => setDraftFilters(EMPTY_TRADE_FILTERS)}
            primary="Aplicar filtros"
            onPrimary={() => { setColumns(draftFilters); setFiltersOpen(false); }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

function TradeCard({ item, code, client, take, difference }: {
  item: TradeIn;
  code: string;
  client: string;
  take: string;
  difference: string;
}) {
  return (
    <span className="sale-card cj-card">
      <span className="sale-top">
        <span className="sale-id">#{code} · {formatShortDate(item.date)}</span>
        {item.status ? <Pill status={item.status} kind="TRADE_IN_STATUS" /> : null}
      </span>
      <b>Recibido: {item.deviceReceived || '—'}</b>
      {tradeQuality(item.grade) ? <small>Calidad {qualityDetail(tradeQuality(item.grade))}</small> : null}
      {item.deviceReceivedImei ? <small>IMEI {item.deviceReceivedImei}</small> : null}
      <span className="sale-bot"><span>{client}</span><b>{take}</b></span>
      <span className="sale-bot"><span>Entrega: {item.deviceGiven || '—'}</span><b>dif. {difference}</b></span>
      {item.confirmationStatus === 'PENDING' ? <small className="trade-confirmation pending">Pendiente de confirmación</small> : null}
      {item.confirmationStatus === 'CONFIRMED' ? <small className="trade-confirmation">Canje confirmado</small> : null}
      {item.confirmationStatus === 'CANCELLED' ? <small className="trade-confirmation cancelled">Operación cancelada</small> : null}
    </span>
  );
}

function TradeEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="inv-empty" data-testid="tradeins-empty">
      <div className="inv-empty-box">
        <div className="inv-empty-mark"><ImanagerIcon name="canje" size={24} /></div>
        <b>No hay canjes</b>
        <p>Todavía no registraste canjes. Cargá el primero cuando tomes un equipo como parte de pago.</p>
        <button className="dbtn p" type="button" onClick={onCreate}>
          <ImanagerIcon name="agregar" size={16} />
          Nuevo canje
        </button>
      </div>
      <p className="inv-count">0 resultados</p>
    </div>
  );
}
