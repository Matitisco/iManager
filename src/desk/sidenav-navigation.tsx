import { useState, useSyncExternalStore } from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { DeskIcon } from './ui';
import { desktopNav, groupOf, groupPending, moreTestId, pendingDescription, sectionPending, type PendingInput, type NavIcon } from './nav';
import { tabFromHash } from './hash-route';
import type { DeskTab } from './types';

const subscribeHash = (notify: () => void) => {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
};
const readHash = () => window.location.hash;
export function useNavigationHash() {
  return useSyncExternalStore(subscribeHash, readHash, () => '#/dashboard');
}

export function SidenavGlyph({ name, size = 18 }: { name: NavIcon; size?: number }) {
  return name === 'help' ? <CircleHelp size={size} /> : <DeskIcon name={name} size={size} />;
}

type Props = {
  nav: ReturnType<typeof desktopNav>;
  pending: PendingInput;
  activeHash: string;
  mobile?: boolean;
  onOpen: (tab: DeskTab, hash?: string) => void;
};

/** The same permitted destinations and exclusive disclosure on desktop and Más. */
export function SidenavNavigation({ nav, pending, activeHash, mobile = false, onOpen }: Props) {
  const activeTab = tabFromHash(activeHash);
  const group = groupOf(activeTab) ?? (nav.cuenta.some(item => item.id === activeTab) ? 'cuenta' : null);
  const blocks = [...nav.main, ...(nav.cuenta.length ? [{ kind: 'group' as const, id: 'cuenta', label: 'Cuenta', icon: 'gear' as const, items: nav.cuenta }] : [])];
  const [state, setState] = useState<{ route: string; expanded: string | null }>({ route: activeHash, expanded: group });
  // Synchronize before paint, including query-only navigation and browser Back.
  if (state.route !== activeHash) setState({ route: activeHash, expanded: group });
  const expanded = state.route === activeHash ? state.expanded : group;
  const destination = (item: { id: DeskTab; label: string; icon: NavIcon }) => {
    const on = activeTab === item.id;
    const count = sectionPending(item.id, pending);
    const description = pendingDescription([item.id], pending) || undefined;
    return <button key={item.id} className={`ditem sn-destination${on ? ' on' : ''}`} type="button" aria-current={on ? 'page' : undefined} data-testid={mobile ? moreTestId(item.id) : `sidebar-tab-${item.id}`} onClick={() => onOpen(item.id, undefined)}>
      <span className="dic"><SidenavGlyph name={item.icon} /></span>
      <span className="sn-label">{item.label}</span>
      {count > 0 ? <span className="dcount" title={description} aria-label={description}>{count}</span> : null}
    </button>;
  };

  return <nav className={`dnav sn-nav${mobile ? ' sn-mobile' : ''}`} aria-label="Navegación principal">
    <div className="dgroup">
      {blocks.map(block => {
        if (block.kind === 'link') return destination(block.item);
        const open = expanded === block.id;
        const ids = block.items.map(item => item.id);
        const count = groupPending(ids, pending);
        const description = pendingDescription(ids, pending) || undefined;
        const panelId = `sn-${mobile ? 'mobile' : 'desktop'}-${block.id}`;
        return <div key={block.id} className={block.id === 'cuenta' ? 'sn-account' : undefined} data-testid={`nav-group-${block.id}`}>
          <button type="button" className={`ditem sn-trigger${group === block.id ? ' sn-current-group' : ''}`} aria-expanded={open} aria-controls={panelId} onClick={() => setState({ route: activeHash, expanded: open ? null : block.id })}>
            <span className="dic"><SidenavGlyph name={block.icon} /></span>
            <span className="sn-label">{block.label}</span>
            {count > 0 ? <span className="dcount" title={description} aria-label={description}>{count}</span> : null}
            <ChevronDown size={16} className="sn-chevron" aria-hidden="true" />
          </button>
          <div id={panelId} className="sn-children" hidden={!open}>
            {block.items.map(item => destination(item))}
          </div>
        </div>;
      })}
    </div>
  </nav>;
}
