import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { PatternClaimView, PatternGroupBy, ReturnPatternSummary, ReturnPatternView } from '../../services/returns-api';
import { returnsView } from '../returns-navigation';
import { useNavigationState } from '../route-viewport';
import { sectionAllowed } from '../nav';
import { ListSkeleton } from '../list-skeleton';
import { usePhoneLayout } from '../section-notices';
import { ReturnDetail } from '../overlays/return-case';
import { DeskIcon, Pill, ScreenTitle, useDesk } from '../ui';
import { patternBarWidth, patternPercent } from './patterns-display';
import { ReturnsPatterns } from './ReturnsPatterns';

const groups = [
  { id: 'supplier', label: 'Proveedores' },
  { id: 'model', label: 'Modelos' },
  { id: 'purchase', label: 'Compras' },
] as const;

export function PatternsScreen() {
  const { user, appSession } = useAppContext();
  const scope = `${user?.uid}:${appSession?.store?.id}:${appSession?.membership?.role}:${JSON.stringify(appSession?.membership?.sections)}`;
  return <FallasContent key={scope} />;
}

function FallasContent() {
  const { back, go } = useDesk();
  const phone = usePhoneLayout();
  const { user, appSession, backendStatus } = useAppContext();
  const allowed = !!user && !!appSession?.store && !appSession.onboardingRequired && sectionAllowed('patterns', appSession.membership.sections, appSession.membership.role);
  const [summary, setSummary] = useState<ReturnPatternSummary | null>();
  const updateSummary = useCallback((value: ReturnPatternSummary | null) => setSummary(previous => value ?? previous ?? null), []);
  const [recent, setRecent] = useState<PatternClaimView[]>([]);
  const updateRecent = useCallback((patterns: ReturnPatternView[]) => {
    const claims = new Map(patterns.flatMap(row => row.claimsDetail).map(claim => [claim.id, claim]));
    setRecent([...claims.values()].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt) || b.caseNumber.localeCompare(a.caseNumber, 'es', { numeric: true })).slice(0, 2));
  }, []);
  const [claimId, setClaimId] = useState<string | null>(null);
  const recentTrigger = useRef<HTMLButtonElement | null>(null);
  const [view, setView] = useNavigationState('patterns:grouping', () => returnsView(window.location.hash));
  const [groupBy, setGroupBy] = useNavigationState<PatternGroupBy>('patterns:mobile-group', () => returnsView(window.location.hash).groupBy);
  useEffect(() => {
    const sync = () => {
      const next = returnsView(window.location.hash);
      setView(next);
      setGroupBy(next.groupBy);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [setView, setGroupBy]);
  useEffect(() => { if (!claimId) recentTrigger.current?.focus(); }, [claimId]);
  const hasProblems = allowed && !!summary?.problems;
  const showClaims = () => go('returns');
  return <div className="dscreen returns-screen pat-screen" data-testid="fallas-screen">
    <ScreenTitle title="Fallas" back={back} tools={hasProblems ? <button type="button" className="wlink" onClick={showClaims}>Ver reclamos</button> : null} desktop={hasProblems ? <button type="button" className="dbtn p" onClick={showClaims}><DeskIcon name="list" size={16} />Ver reclamos</button> : null} />
    {allowed && (summary ? summary.problems > 0 ? <div className="dstats pat-summary" aria-label="Resumen de fallas">
      <div className="dstat">
        <div className="eb">Equipos con reclamo</div>
        <div className="big">{summary.problems} <small>de {summary.devices}</small></div>
        <span className="pat-count">{phone ? `${patternPercent(summary)} del total` : 'Equipos distintos'}</span>
      </div>
      {!phone ? <>
        <div className="dstat"><div className="eb">Porcentaje afectado</div><div className="big">{patternPercent(summary)}</div><div className="bar"><i style={{ width: patternBarWidth(summary) }} /></div></div>
        <div className="dstat"><div className="eb">Reclamos registrados</div><div className="big">{summary.claims}</div><span className="pat-count">En {summary.problems} {summary.problems === 1 ? 'equipo' : 'equipos'}</span></div>
      </> : null}
      <div className="dstat">
        <div className="eb">Motivo más frecuente</div>
        <div className="big pat-reason-value">{summary.topReason?.label ?? 'Sin motivo registrado'}</div>
        {summary.topReason ? <span className="pat-count">{summary.topReason.claims} de {summary.claims} reclamos</span> : null}
      </div>
    </div> : null : summary === undefined && (backendStatus === 'ready' || backendStatus === 'checking') ? <div className="pat-summary-loading"><ListSkeleton variant="cards" rows={1} /></div> : null)}
    {allowed && summary?.problems === 0 ? <div className="wempty" data-testid="fallas-empty">No hay equipos con reclamo.</div> : null}
    {allowed && phone && summary?.problems !== 0 ? <div className="wchips pat-group-tabs" role="tablist" aria-label="Agrupar fallas">{groups.map(group => <button key={group.id} type="button" role="tab" id={`pat-tab-${group.id}`} aria-selected={groupBy === group.id} aria-controls={`pat-panel-${group.id}`} className={`sg${groupBy === group.id ? ' on' : ''}`} onClick={() => setGroupBy(group.id)}>{group.label}</button>)}</div> : null}
    <div className="dgrid pat-sections" hidden={summary?.problems === 0}>
      {groups.map(option => <div key={option.id} id={`pat-panel-${option.id}`} role={phone ? 'tabpanel' : undefined} aria-labelledby={phone ? `pat-tab-${option.id}` : undefined} hidden={phone && groupBy !== option.id}>
        <ReturnsPatterns title={phone ? `${option.label} con más fallas` : option.label} groupBy={option.id} request={view.groupBy === option.id ? view : undefined} onSummary={option.id === 'model' ? updateSummary : undefined} onPatterns={option.id === 'model' ? updateRecent : undefined} />
      </div>)}
    </div>
    {hasProblems && !phone && recent.length ? <section className="pat-recent" aria-label="Reclamos recientes">
      <div className="dch"><h3>Reclamos recientes</h3><button type="button" className="wlink" onClick={showClaims}>Ver todos ({summary.claims})</button></div>
      <div className="dcard flush"><table className="dtable compact pat-recent-table"><thead><tr><th>Reclamo</th><th>Equipo / cliente</th><th>Motivo</th><th>Estado</th><th><span className="sr-only">Acción</span></th></tr></thead><tbody>{recent.map(claim => <tr key={claim.id}>
        <td><b>{claim.caseNumber}</b><small>{new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(claim.openedAt))}</small></td>
        <td><b>{claim.deviceLabel}</b><small>{claim.clientName}</small></td><td>{claim.reason}</td><td><Pill status={claim.rmaStatus || claim.status} /></td>
        <td><button type="button" className="pat-recent-open" aria-label={`Ver reclamo ${claim.caseNumber}`} onClick={event => { recentTrigger.current = event.currentTarget; setClaimId(claim.id); }}><span aria-hidden="true">›</span></button></td>
      </tr>)}</tbody></table></div>
    </section> : null}
    {allowed && claimId ? <ReturnDetail id={claimId} onClose={() => setClaimId(null)} overlayClassName="subov pat-claim-layer" /> : null}
  </div>;
}
