import { useCallback, useEffect, useRef, useState } from 'react';
import { toUserMessage } from '../lib/user-message';
import { canOpenSection } from '../desk/sections';
import { fetchSectionChanges, markSectionViewed, type RecordVersion, type SectionChanges, type ViewSection } from '../services/section-views-api';
import type { AuthUserLike } from '../types/auth-user';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';

export function useSectionViewsState(user: AuthUserLike | null, session: AppSession | null, status: BackendConnectionStatus, records: unknown[]) {
  const scope = `${user?.uid}:${session?.store?.id}:${session?.membership?.role}:${JSON.stringify(session?.membership?.sections)}:${status}:${Boolean(session?.onboardingRequired)}`;
  const ready = !!user && status === 'ready' && !!session?.store && !session.onboardingRequired;
  const current = useRef({ scope, generation: 0 });
  if (current.current.scope !== scope) current.current = { scope, generation: 0 };
  const [state, setState] = useState<{ scope: string; changes: SectionChanges; error: string }>({ scope, changes: {}, error: '' });

  const refreshSectionChanges = useCallback(async () => {
    if (!ready || !user) return;
    const epoch = current.current;
    const generation = ++epoch.generation;
    try {
      const { sections } = await fetchSectionChanges(user);
      if (current.current !== epoch || epoch.generation !== generation) return;
      setState({ scope, changes: sections, error: '' });
    } catch (error) {
      if (current.current === epoch && epoch.generation === generation) {
        setState(previous => ({ scope, changes: previous.scope === scope ? previous.changes : {}, error: toUserMessage(error) }));
      }
    }
  }, [user, ready, scope]);

  useEffect(() => {
    void refreshSectionChanges();
    const refreshVisible = () => { if (document.visibilityState === 'visible') void refreshSectionChanges(); };
    const timer = window.setInterval(refreshVisible, 30000);
    window.addEventListener('focus', refreshVisible);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshVisible); };
  }, [refreshSectionChanges, ...records]); // Business mutations also invalidate the counters.

  const viewSection = useCallback(async (section: ViewSection, versions: RecordVersion[]) => {
    if (!ready || !user || !canOpenSection(section, session?.membership?.sections, session?.membership?.role)) {
      throw new Error('El backend todavía no está listo o no tenés acceso a esta sección.');
    }
    const epoch = current.current;
    ++epoch.generation; // An older GET must not resurrect versions just acknowledged.
    try {
      // Bound each payload, but acknowledge every page in the section.
      for (let start = 0; start < versions.length; start += 1000) {
        const { viewed } = await markSectionViewed(user, section, versions.slice(start, start + 1000));
        if (current.current !== epoch) return;
        ++epoch.generation;
        const seen = new Map(viewed.map(row => [row.id, row.updatedAt]));
        setState(previous => previous.scope !== scope ? previous : {
          ...previous, error: '', changes: { ...previous.changes,
            [section]: previous.changes[section]?.filter(row => !seen.has(row.id) || seen.get(row.id)! < row.updatedAt) ?? [],
          },
        });
      }
    } catch (error) {
      if (current.current === epoch) setState(previous => ({ ...previous, error: toUserMessage(error) }));
      throw error;
    }
  }, [user, ready, scope, session?.membership?.role, session?.membership?.sections]);

  return {
    sectionChanges: ready && state.scope === scope ? state.changes : {},
    sectionChangesError: ready && state.scope === scope ? state.error : '',
    refreshSectionChanges,
    viewSection,
  };
}
