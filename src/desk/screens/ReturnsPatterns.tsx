import { useEffect, useId, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchReturnPatterns, type PatternGroupBy, type ReturnPatternView } from '../../services/returns-api';
import { canSeeFinancials } from '../sections';
import { sectionAllowed } from '../nav';
import { ListSkeleton } from '../list-skeleton';
import { usePhoneLayout } from '../section-notices';
import { SupplierPurchaseDetail } from '../overlays/supplier-purchases';
import { DeskIcon, Pill, useDesk } from '../ui';
import './returns-patterns.css';

export function ReturnsPatterns({ groupBy, request }: { groupBy: PatternGroupBy; request?: { group?: string } }) {
  const { user, appSession, backendStatus, returns, inventory, repairOrders } = useAppContext();
  const { open } = useDesk();
  const phone = usePhoneLayout();
  const detailId = useId();
  const [cache, setCache] = useState<Partial<Record<PatternGroupBy, ReturnPatternView[]>>>({});
  const [errors, setErrors] = useState<Partial<Record<PatternGroupBy, boolean>>>({});
  const [selection, setSelection] = useState<{ by: PatternGroupBy; key: string | null } | null>(null);
  const [purchase, setPurchase] = useState<ReturnPatternView | null>(null);
  const sections = appSession?.membership?.sections;
  const role = appSession?.membership?.role;
  const allowed = sectionAllowed('patterns', sections, role);
  const seeOrigin = sectionAllowed('suppliers', sections, role);
  const ready = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired && allowed;
  const rows = cache[groupBy];
  const preferredKey = selection?.by === groupBy ? selection.key : request?.group;
  const selected = preferredKey === null ? undefined : rows?.find(row => row.key === preferredKey) ?? rows?.[0];
  const selectedKey = selected?.key;

  useEffect(() => {
    setSelection(null);
  }, [groupBy, request]);

  useEffect(() => {
    if (!user || !ready) return;
    let active = true;
    void fetchReturnPatterns(user, groupBy).then(result => {
      if (active) {
        setCache(current => ({ ...current, [groupBy]: result.filter(row => row.problems > 0) }));
        setErrors(current => ({ ...current, [groupBy]: false }));
      }
    }).catch(() => {
      if (active) setErrors(current => ({ ...current, [groupBy]: true }));
    });
    return () => { active = false; };
  }, [user, ready, groupBy, returns, inventory, repairOrders]);

  const openOrigin = (row: ReturnPatternView) => {
    if (!seeOrigin || !row.supplierId) return;
    if (groupBy === 'purchase' && row.purchaseId) setPurchase(row);
    else if (groupBy === 'supplier') open({ type: 'supplier', id: row.supplierId });
  };
  const toggle = (row: ReturnPatternView) => setSelection({ by: groupBy, key: selectedKey === row.key ? null : row.key });
  const originLabel = groupBy === 'purchase' ? 'Ver compra' : 'Ver proveedor';
  const originAvailable = (row: ReturnPatternView) => seeOrigin && !!row.supplierId && groupBy !== 'model';
  const claims = (row: ReturnPatternView) => <>
    {row.topReason ? <p className="pat-note" data-testid="pattern-reason">{row.topReason.claims} de {row.claims} reclamos son por {row.topReason.label}</p> : null}
    <div className="pat-claims ledger-list">
      {row.claimsDetail.map(claim => <button className="member return-row" type="button" key={claim.id} onClick={() => open({ type: 'return', id: claim.id })}>
        <span className="ico-row" aria-hidden="true"><DeskIcon name="list" size={16} /></span>
        <span className="info">
          <span className="name">{[claim.caseNumber, claim.clientName].filter(Boolean).join(' · ')}</span>
          <span className="role">{[claim.deviceLabel, claim.reason].filter(Boolean).join(' · ')}</span>
        </span>
        <Pill status={claim.rmaStatus || claim.status} />
      </button>)}
    </div>
    {row.claimsTruncated ? <p className="pat-limit">Mostrando {row.claimsDetail.length} de {row.claims} reclamos</p> : null}
  </>;

  if (!allowed || !user || !appSession?.store || appSession.onboardingRequired) return null;
  const error = errors[groupBy] ? <p className="ferr" role="alert">No se pudieron cargar los patrones.</p> : null;
  if (!rows && error) return error;
  if (!rows && backendStatus !== 'ready' && backendStatus !== 'checking') return null;
  if (!rows) return <div className="pat-grid pat-loading" data-testid="patterns-loading">
    <ListSkeleton variant="cards" rows={4} />
    {!phone ? <ListSkeleton variant="cards" rows={4} /> : null}
  </div>;
  if (!rows.length) return error ?? <div className="wempty" data-testid="patterns-empty">No hay equipos con problemas en esta agrupación.</div>;

  return <>
    {error}
    <div className="pat-grid" data-testid="returns-patterns">
      <div className="card ledger-list pat-list">
        {rows.map((row, index) => {
          const expanded = selected?.key === row.key;
          const id = `${detailId}-${index}`;
          return <div className="pat-group" key={row.key}>
            <div className={`member pat-row${expanded ? ' on' : ''}${row.hot ? ' hot' : ''}`} data-testid={`pattern-${row.key}`}>
              <button className="info pat-name" type="button" onClick={() => originAvailable(row) ? openOrigin(row) : toggle(row)} aria-label={originAvailable(row) ? `${originLabel}: ${row.label}` : undefined} aria-expanded={!originAvailable(row) ? expanded : undefined} aria-controls={!originAvailable(row) && expanded ? (phone ? id : detailId) : undefined}>
                <span className="name">{row.label}</span>
                <span className="role">{row.problems} de {row.devices} {row.devices === 1 ? 'equipo' : 'equipos'}</span>
              </button>
              <button className="pat-val" type="button" aria-label={`Reclamos de ${row.label}`} aria-expanded={expanded} aria-controls={expanded ? (phone ? id : detailId) : undefined} onClick={() => toggle(row)}>
                <span className="pat-bar" aria-hidden="true"><i style={{ width: `${row.percent}%` }} /></span>
                <span className="pat-pct">{row.percent}%</span>
              </button>
            </div>
            {phone && expanded ? <div className="pat-open" id={id} role="region" aria-label={`Reclamos de ${row.label}`}>{claims(row)}</div> : null}
          </div>;
        })}
      </div>
      {!phone && selected ? <div className="card pat-detail" id={detailId} role="region" aria-label={`Reclamos de ${selected.label}`}>
        <div className="dch"><div><h3>{selected.label}</h3><p>{selected.devices} {selected.devices === 1 ? 'equipo' : 'equipos'}</p></div>
          {originAvailable(selected) ? <button className="wlink" type="button" onClick={() => openOrigin(selected)}>{originLabel}</button> : null}
        </div>
        {claims(selected)}
      </div> : null}
    </div>
    {purchase?.supplierId && purchase.purchaseId && seeOrigin ? <SupplierPurchaseDetail supplierId={purchase.supplierId} purchase={{ id: purchase.purchaseId, devices: purchase.devices, problemCount: purchase.problems }} seeCosts={canSeeFinancials(sections, role)} onClose={() => setPurchase(null)} /> : null}
  </>;
}
