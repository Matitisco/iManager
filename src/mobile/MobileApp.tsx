import './mobile.css';
import { MobileProvider, useMobileUi } from './state';
import { OverlayHost } from './sheets';
import {
  ClientsScreen,
  DashboardScreen,
  InventoryScreen,
  MobileNav,
  MoreScreen,
  NotificationsScreen,
  ReportsScreen,
  SalesScreen,
  SettingsScreen,
  TradeInsScreen,
} from './screens';

function Stage() {
  const { screen } = useMobileUi();
  switch (screen) {
    case 'inv': return <InventoryScreen />;
    case 'ven': return <SalesScreen />;
    case 'rep': return <ReportsScreen />;
    case 'mas': return <MoreScreen />;
    case 'canjes': return <TradeInsScreen />;
    case 'clientes': return <ClientsScreen />;
    case 'config': return <SettingsScreen />;
    case 'notif': return <NotificationsScreen />;
    default: return <DashboardScreen />;
  }
}

function Frame() {
  const { toastMessage } = useMobileUi();
  return (
    <div className="im-app">
      <div className="phone">
        <div className="stage">
          <Stage />
        </div>
        <MobileNav />
        <div className="homebar" />
        <div className={`toast${toastMessage ? ' show' : ''}`} role="status">
          <span>{toastMessage}</span>
        </div>
        <OverlayHost />
      </div>
    </div>
  );
}

export function MobileApp() {
  return (
    <MobileProvider>
      <Frame />
    </MobileProvider>
  );
}
