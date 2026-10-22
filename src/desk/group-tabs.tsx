import { createContext, useContext, type ReactNode } from 'react';
import { useAppContext } from '../context/AppContext';
import { DeskContext } from './desk-context';
import { pageTabs, sectionPending, pendingDescription, type PendingInput } from './nav';
import type { DeskTab } from './types';

const PendingContext = createContext<PendingInput | null>(null);

export function NavChrome({ pending, children }: { pending: PendingInput; children: ReactNode }) {
  return <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>;
}

function GroupTabsOn({ pending, tab, go }: { pending: PendingInput; tab: DeskTab; go: (tab: DeskTab) => void }) {
  const { appSession } = useAppContext();
  const sections = appSession?.membership?.sections;
  const role = appSession?.membership?.role;
  const tabs = pageTabs(tab, sections, role);
  if (tabs.length < 2) return null;
  return (
    <div className="wchips nav-tabs" role="tablist" aria-label="Secciones del grupo">
      {tabs.map((item) => {
        const count = sectionPending(item.id, pending);
        const on = item.id === tab;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={on}
            title={pendingDescription([item.id], pending) || undefined}
            aria-description={pendingDescription([item.id], pending) || undefined}
            className={`sg${on ? ' on' : ''}`}
            data-testid={`group-tab-${item.id}`}
            onClick={() => go(item.id)}
          >
            {count > 0 ? `${item.label} · ${count}` : item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pestañas del grupo, arriba de la página. Sin el chrome del escritorio no se muestra. */
export function GroupTabs() {
  const pending = useContext(PendingContext);
  const desk = useContext(DeskContext);
  if (!pending || !desk) return null;
  return <GroupTabsOn pending={pending} tab={desk.tab} go={desk.go} />;
}
