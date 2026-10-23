import { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { returnsView } from '../returns-navigation';
import { useNavigationState } from '../route-viewport';
import { ScreenTitle, useDesk } from '../ui';
import { ReturnsPatterns } from './ReturnsPatterns';

export function PatternsScreen() {
  const { user, appSession } = useAppContext();
  const { back } = useDesk();
  const [view, setView] = useNavigationState('patterns:grouping', () => returnsView(window.location.hash));
  useEffect(() => {
    const sync = () => setView(returnsView(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [setView]);
  const scope = `${user?.uid}:${appSession?.store?.id}:${appSession?.membership?.role}:${JSON.stringify(appSession?.membership?.sections)}`;
  return <div className="dscreen returns-screen" data-testid="patterns-screen">
    <ScreenTitle title="Patrones" back={back} tools={null} desktop={null} />
    <div className="gfilters pat-filters">
      <div className="pat-by" role="group" aria-label="Agrupar">
        {([{ id: 'supplier', label: 'Proveedor' }, { id: 'purchase', label: 'Compra' }, { id: 'model', label: 'Modelo' }] as const).map(option => <button key={option.id} className={`gchip sm${view.groupBy === option.id ? ' on' : ''}`} type="button" aria-pressed={view.groupBy === option.id} onClick={() => setView({ patterns: true, groupBy: option.id, group: undefined })}>{option.label}</button>)}
      </div>
    </div>
    <ReturnsPatterns key={scope} groupBy={view.groupBy} requestedGroup={view.group} />
  </div>;
}
