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
    <div className="dgrid pat-sections">
      {([{ id: 'supplier', label: 'Proveedor' }, { id: 'purchase', label: 'Compra' }, { id: 'model', label: 'Modelo' }] as const).map(option => <section className="pat-section" key={`${scope}:${option.id}`} aria-labelledby={`patterns-${option.id}`}>
        <div className="dch"><h3 id={`patterns-${option.id}`}>{option.label}</h3></div>
        <ReturnsPatterns groupBy={option.id} request={view.groupBy === option.id ? view : undefined} />
      </section>)}
    </div>
  </div>;
}
