import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchReturnAnalysis, type PatternGroupBy, type ReturnPatternSummary, type ReturnPatternView } from '../../services/returns-api';
import { canSeeFinancials } from '../sections';
import { sectionAllowed } from '../nav';
import { ListSkeleton } from '../list-skeleton';
import { usePhoneLayout } from '../section-notices';
import { SupplierPurchaseDetail } from '../overlays/supplier-purchases';
import { ReturnDetail } from '../overlays/return-case';
import { DeskIcon, Pill, Sheet, useDesk } from '../ui';
import { patternPercent, patternBarWidth } from './patterns-display';
import './returns-patterns.css';

export function ReturnsPatterns({ groupBy, title = 'Fallas', request, onSummary, onPatterns }: { groupBy: PatternGroupBy; title?: string; request?: { group?: string }; onSummary?: (summary: ReturnPatternSummary | null) => void; onPatterns?: (patterns: ReturnPatternView[]) => void }) {
  const { user, appSession, backendStatus, returns, inventory, repairOrders } = useAppContext();
  const { open } = useDesk();
  const phone = usePhoneLayout();
  const [rows, setRows] = useState<ReturnPatternView[]>();
  const [failed, setFailed] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [allRows, setAllRows] = useState(false);
  const [allClaims, setAllClaims] = useState(false);
  const [claimId, setClaimId] = useState<string | null>(null);
  const claimButtons = useRef(new Map<string, HTMLButtonElement>());
  const lastClaim = useRef<string | null>(null);
  const [purchase, setPurchase] = useState<ReturnPatternView | null>(null);
  const handledRequest = useRef<typeof request>(undefined);
  const sections = appSession?.membership?.sections;
  const role = appSession?.membership?.role;
  const allowed = sectionAllowed('patterns', sections, role);
  const seeOrigin = sectionAllowed('suppliers', sections, role);
  const ready = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired && allowed;
  const selected = rows?.find(row => row.key === selectedKey);

  useEffect(() => {
    if (!claimId && lastClaim.current) {
      claimButtons.current.get(lastClaim.current)?.focus();
      lastClaim.current = null;
    }
  }, [claimId]);

  useEffect(() => {
    if (!user || !ready) return;
    let active = true;
    void fetchReturnAnalysis(user, groupBy).then(result => {
      if (active) {
        setRows(result.patterns.filter(row => row.problems > 0));
        setFailed(false);
        onSummary?.(result.summary);
        onPatterns?.(result.patterns);
      }
    }).catch(() => { if (active) { setFailed(true); onSummary?.(null); } });
    return () => { active = false; };
  }, [user, ready, groupBy, returns, inventory, repairOrders, onSummary, onPatterns]);

  useEffect(() => {
    if (!rows || request === handledRequest.current) return;
    handledRequest.current = request;
    setAllRows(false);
    setAllClaims(false);
    setClaimId(null);
    setSelectedKey(request?.group && rows.some(row => row.key === request.group) ? request.group : null);
  }, [request, rows]);

  const closeDetail = () => { setSelectedKey(null); setAllClaims(false); setClaimId(null); };
  const select = (row: ReturnPatternView) => { setAllRows(false); setAllClaims(false); setSelectedKey(row.key); };
  const originLabel = groupBy === 'purchase' ? 'Ver compra' : 'Ver proveedor';
  const originAvailable = (row: ReturnPatternView) => seeOrigin && !!row.supplierId && groupBy !== 'model';
  const openOrigin = (row: ReturnPatternView) => {
    closeDetail();
    if (groupBy === 'purchase' && row.purchaseId) setPurchase(row);
    else if (row.supplierId) open({ type: 'supplier', id: row.supplierId });
  };
  const ranking = (items: ReturnPatternView[]) => <div className={phone ? 'phone-rows pat-ranking' : 'pat-ranking'}>
    {items.map(row => <button className={`${phone ? 'phone-row' : 'member'} pat-row`} data-testid={`pattern-${row.key}`} key={row.key} type="button" aria-label={`Reclamos de ${row.label}`} onClick={() => select(row)}>
      <span className="pat-rank-heading"><span className="pat-name" title={row.label}>{row.label}</span><span className="chev" aria-hidden="true">›</span></span>
      <span className="pat-rank-fraction"><strong>{row.problems}</strong>{' '}<span>de {row.devices} {row.devices === 1 ? 'equipo' : 'equipos'}</span><b>{patternPercent(row)}</b></span>
      <span className="pat-bar" aria-hidden="true"><i style={{ width: patternBarWidth(row) }} /></span>
      <span className="pat-rank-reason"><span className="pat-reason">{row.topReason?.label ?? row.claimsDetail[0]?.reason ?? 'Sin motivo registrado'}</span>{row.topReason ? <span>{row.topReason.claims} de {row.claims} reclamos</span> : null}</span>
    </button>)}
  </div>;
  const claims = (row: ReturnPatternView, complete: boolean) => <div className="pat-claims ledger-list">
    {(complete ? row.claimsDetail : row.claimsDetail.slice(0, 3)).map(claim => <button ref={node => { if (node) claimButtons.current.set(claim.id, node); else claimButtons.current.delete(claim.id); }} className="member return-row" type="button" key={claim.id} onClick={() => { lastClaim.current = claim.id; setClaimId(claim.id); }}>
      <span className="ico-row" aria-hidden="true"><DeskIcon name="list" size={16} /></span>
      <span className="info"><span className="name">{[claim.caseNumber, claim.clientName].filter(Boolean).join(' · ')}</span><span className="role">{[claim.deviceLabel, claim.reason].filter(Boolean).join(' · ')}</span></span>
      <Pill status={claim.rmaStatus || claim.status} />
    </button>)}
    {!row.claimsDetail.length ? <div className="wempty">No hay reclamos registrados.</div> : null}
    {complete && row.claimsTruncated ? <p className="pat-count">Mostrando {row.claimsDetail.length} de {row.claims} reclamos</p> : null}
  </div>;

  if (!allowed || !user || !appSession?.store || appSession.onboardingRequired) return null;
  return <>
    <section className="dcard pat-section" aria-label={title}>
      <div className="dch"><h3>{title}</h3>{!phone && rows && rows.length > 3 ? <button className="wlink" type="button" onClick={() => setAllRows(true)}>Ver todos ({rows.length})</button> : null}</div>
      {!phone ? <div className="pat-column-label">Equipos con reclamo</div> : null}
      {failed ? <p className="ferr" role="alert">No se pudieron cargar las fallas.</p> : null}
      {!rows && !failed && (ready || backendStatus === 'checking') ? <div data-testid="fallas-loading"><ListSkeleton variant="cards" rows={5} /></div> : null}
      {rows?.length ? ranking(rows.slice(0, 3)) : rows && !failed ? <div className="wempty" data-testid="fallas-group-empty">No hay equipos con reclamo.</div> : null}
      {phone && rows && rows.length > 3 ? <button className="wlink pat-view-all" type="button" onClick={() => setAllRows(true)}>Ver todos ({rows.length})</button> : null}
    </section>
    {allRows && rows ? <Sheet title={title} onClose={() => setAllRows(false)} className="pat-all-sheet" mobileBack={phone} overlayClassName="subov" footer={null}>{ranking(rows)}</Sheet> : null}
    {selected && !allClaims && !claimId ? <Sheet title={selected.label} onClose={closeDetail} className="pat-detail" overlayClassName="subov" footer={originAvailable(selected) ? <div className="sacts"><button className="btn2 s" type="button" onClick={closeDetail}>Cerrar</button><button className="btn2 p" type="button" onClick={() => openOrigin(selected)}>{originLabel}</button></div> : null}>
      <div className="pat-detail-metrics"><strong>{patternPercent(selected)}</strong><span>{selected.problems} de {selected.devices} equipos</span></div>
      <div className="ret-sec"><h4>Reclamos</h4>{selected.claimsDetail.length > 3 ? <button className="wlink" type="button" onClick={() => setAllClaims(true)}>Ver todos ({selected.claims})</button> : null}</div>
      {claims(selected, false)}
    </Sheet> : null}
    {selected && allClaims && !claimId ? <Sheet title="Todos los reclamos" onClose={() => setAllClaims(false)} mobileBack={phone} className="pat-all-sheet pat-detail" overlayClassName="subov" footer={null}>{claims(selected, true)}</Sheet> : null}
    {claimId ? <ReturnDetail id={claimId} onClose={() => setClaimId(null)} overlayClassName="subov pat-claim-layer" /> : null}
    {purchase?.supplierId && purchase.purchaseId && seeOrigin ? <SupplierPurchaseDetail supplierId={purchase.supplierId} purchase={{ id: purchase.purchaseId, devices: purchase.devices, problemCount: purchase.problems }} seeCosts={canSeeFinancials(sections, role)} onClose={() => setPurchase(null)} /> : null}
  </>;
}
