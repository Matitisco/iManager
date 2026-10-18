import { DeskIcon } from '../ui';
import './team.css';

export function NoSectionAccess({ section, ownerName, onDashboard }: { section: string; ownerName: string; onDashboard: () => void }) {
  return <div className="dscreen no-access-screen"><section className="team-denied" data-testid="no-section-access">
    <div className="team-denied-icon"><DeskIcon name="lock" size={25} /></div>
    <small>{section}</small><h1>No tenés acceso</h1>
    <p>Esta sección la habilita el dueño de la tienda.</p>
    <p className="owner-access">Pedile acceso a {ownerName}</p>
    <button type="button" onClick={onDashboard}>Volver al Dashboard</button>
  </section></div>;
}
