import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { ReturnPatternSummary } from '../../services/returns-api';
import { returnsView } from '../returns-navigation';
import { useNavigationState } from '../route-viewport';
import { sectionAllowed } from '../nav';
import { ListSkeleton } from '../list-skeleton';
import { ScreenTitle, useDesk } from '../ui';
import { ReturnsPatterns } from './ReturnsPatterns';

export function PatternsScreen() {
  const { user, appSession } = useAppContext();
  const scope = `${user?.uid}:${appSession?.store?.id}:${appSession?.membership?.role}:${JSON.stringify(appSession?.membership?.sections)}`;
  return <FallasContent key={scope} />;
}

function FallasContent() {
  const { back } = useDesk();
  const { user, appSession, backendStatus } = useAppContext();
  const allowed = !!user && !!appSession?.store && !appSession.onboardingRequired && sectionAllowed('patterns', appSession.membership.sections, appSession.membership.role);
  const [summary, setSummary] = useState<ReturnPatternSummary | null>();
  const updateSummary = useCallback((value: ReturnPatternSummary | null) => setSummary(previous => value ?? previous ?? null), []);
  const [view, setView] = useNavigationState('patterns:grouping', () => returnsView(window.location.hash));
  useEffect(() => {
    const sync = () => setView(returnsView(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [setView]);
  return <div className="dscreen returns-screen" data-testid="fallas-screen">
    <ScreenTitle title="Fallas" back={back} tools={null} desktop={null} />
    {allowed && (summary ? summary.problems > 0 ? <div className="dstats pat-summary" aria-label="Resumen de fallas">
      <div className="dstat">
        <div className="eb">Equipos con reclamo</div>
        <div className="big">{summary.percent}%</div>
        <span className="pat-count">{summary.problems} de {summary.devices} equipos</span>
        <div className="bar"><i style={{ width: `${summary.percent}%` }} /></div>
      </div>
      <div className="dstat">
        <div className="eb">Motivo más frecuente</div>
        <div className="big pat-reason-value">{summary.topReason?.label ?? 'Sin motivo registrado'}</div>
        {summary.topReason ? <span className="pat-count">{summary.topReason.claims} de {summary.claims} reclamos</span> : null}
      </div>
    </div> : null : summary === undefined && (backendStatus === 'ready' || backendStatus === 'checking') ? <div className="pat-summary-loading"><ListSkeleton variant="cards" rows={1} /></div> : null)}
    {allowed && summary?.problems === 0 ? <div className="wempty" data-testid="fallas-empty">No hay equipos con reclamo.</div> : null}
    <div className="dgrid pat-sections" hidden={summary?.problems === 0}>
      {([{ id: 'supplier', label: 'Proveedores con más fallas' }, { id: 'purchase', label: 'Compras con más fallas' }, { id: 'model', label: 'Modelos con más fallas' }] as const).map(option => <ReturnsPatterns key={option.id} title={option.label} groupBy={option.id} request={view.groupBy === option.id ? view : undefined} onSummary={option.id === 'model' ? updateSummary : undefined} />)}
    </div>
  </div>;
}
