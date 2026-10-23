import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useAppContext } from '../context/AppContext';
import { DeskContext } from './desk-context';
import { groupOf, pageTabs, sectionPending, pendingDescription, type PendingInput } from './nav';
import type { DeskTab } from './types';

const PendingContext = createContext<PendingInput | null>(null);

export function NavChrome({ pending, children }: { pending: PendingInput; children: ReactNode }) {
  return <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>;
}

type GroupTabsProps = { tab?: DeskTab; labels?: Partial<Record<DeskTab, string>>; showPending?: boolean };

function GroupTabsOn({ pending, tab, go, labels, showPending = true }: { pending: PendingInput; tab: DeskTab; go: (tab: DeskTab) => void } & Omit<GroupTabsProps, 'tab'>) {
  const { appSession } = useAppContext();
  const sections = appSession?.membership?.sections;
  const role = appSession?.membership?.role;
  const tabs = pageTabs(tab, sections, role);
  const summaryTab = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (tab === 'periodicSummary') summaryTab.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [tab]);
  if (tabs.length < 2) return null;
  return (
    <div className={`wchips nav-tabs${groupOf(tab) === 'analisis' ? ' periodic-report-tabs' : ''}`} role="tablist" aria-label="Secciones del grupo">
      {tabs.map((item) => {
        const count = sectionPending(item.id, pending);
        const on = item.id === tab;
        return (
          <button
            key={item.id}
            ref={item.id === 'periodicSummary' ? summaryTab : undefined}
            type="button"
            role="tab"
            aria-selected={on}
            title={pendingDescription([item.id], pending) || undefined}
            aria-description={pendingDescription([item.id], pending) || undefined}
            className={`sg${on ? ' on' : ''}`}
            data-testid={`group-tab-${item.id}`}
            onClick={() => go(item.id)}
          >
            {showPending && count > 0 ? `${labels?.[item.id] || item.label} · ${count}` : labels?.[item.id] || item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pestañas del grupo, arriba de la página. Sin el chrome del escritorio no se muestra. */
export function GroupTabs({ tab, labels, showPending }: GroupTabsProps = {}) {
  const pending = useContext(PendingContext);
  const desk = useContext(DeskContext);
  if (!pending || !desk) return null;
  return <GroupTabsOn pending={pending} tab={tab || desk.tab} go={desk.go} labels={labels} showPending={showPending} />;
}
