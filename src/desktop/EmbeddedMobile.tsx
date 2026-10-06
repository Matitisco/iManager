import '../mobile/mobile.css';
import { MobileProvider, useMobileUi } from '../mobile/state';
import { OverlayHost } from '../mobile/sheets';
import { NotificationsScreen, ReportsScreen, SettingsScreen } from '../mobile/screens';
import type { MobileScreen } from '../mobile/logic';

function Stage({ screen }: { screen: MobileScreen }) {
  if (screen === 'config') return <SettingsScreen />;
  if (screen === 'notif') return <NotificationsScreen />;
  return <ReportsScreen />;
}

function Frame({ screen }: { screen: MobileScreen }) {
  const { toastMessage } = useMobileUi();
  return (
    <div className="im-app im-embedded">
      <div className="phone">
        <div className="stage">
          <Stage screen={screen} />
        </div>
        <div className={`toast${toastMessage ? ' show' : ''}`} role="status">
          <span>{toastMessage}</span>
        </div>
        <OverlayHost />
      </div>
    </div>
  );
}

export function EmbeddedMobile({
  screen,
  onNavigate,
}: {
  screen: 'rep' | 'config' | 'notif';
  onNavigate: (screen: MobileScreen) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <MobileProvider initialScreen={screen} onNavigate={onNavigate}>
        <Frame screen={screen} />
      </MobileProvider>
    </div>
  );
}
