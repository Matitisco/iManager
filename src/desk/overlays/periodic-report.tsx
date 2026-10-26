import { useEffect } from 'react';
import { useDesk } from '../ui';
import type { PeriodicReportFrequency } from '../../services/periodic-report-api';
import type { FormProps } from './shared';

export function periodicReportSubtitle(enabled: boolean, frequency: PeriodicReportFrequency, recipients: string[]) {
  if (!enabled) return 'Apagado';
  const when = frequency === 'WEEKLY' ? 'Semanal' : frequency === 'BIWEEKLY' ? 'Cada 15 días' : 'Cada mes';
  return recipients.length === 1 ? `${when} · ${recipients[0]}` : recipients.length ? `${when} · ${recipients.length} correos` : when;
}
/** Preserve legacy overlay entrypoints while sharing the single settings destination. */
export function PeriodicReportForm(_props: FormProps) {
  const { close } = useDesk();
  useEffect(() => { close(); window.location.hash = '#/analisis/resumen-periodico?view=mail'; }, [close]);
  return null;
}
