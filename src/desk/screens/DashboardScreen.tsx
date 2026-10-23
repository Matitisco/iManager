import { useAppContext } from '../../context/AppContext';
import { FirstStepsIsland } from '../first-steps-island';
import { DashboardContent, DashboardSkeleton } from './DashboardContent';

export function DashboardScreen() {
  const { appSession, backendStatus, sessionConfirmed, gettingStartedLoaded } = useAppContext();
  if (backendStatus === 'checking' || sessionConfirmed === false || !appSession?.membership?.role || gettingStartedLoaded === false) return <DashboardSkeleton />;
  return (
    <>
      <DashboardContent />
      <FirstStepsIsland />
    </>
  );
}
