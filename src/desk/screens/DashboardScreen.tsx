import { useAppContext } from '../../context/AppContext';
import { FirstStepsIsland } from '../first-steps-island';
import { DashboardContent } from './DashboardContent';
import { NewAccountDashboard } from './NewAccountDashboard';

export function DashboardScreen() {
  const { appSession, gettingStarted } = useAppContext();
  const newAccount = appSession?.store?.onboardingStartedAt || gettingStarted?.eligible;
  return (
    <>
      {newAccount ? <NewAccountDashboard /> : <DashboardContent />}
      <FirstStepsIsland />
    </>
  );
}
