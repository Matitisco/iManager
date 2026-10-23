import { ListSkeleton } from '../list-skeleton';
import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { toUserMessage, isNetworkErrorMessage } from '../../lib/user-message';
import { fetchPeriodicReport, savePeriodicReport, type PeriodicReportFrequency } from '../../services/periodic-report-api';
import { usePhoneLayout } from '../section-notices';
import { Actions, Field, Segs, Sheet, useDesk } from '../ui';
import type { FormProps } from './shared';

export function periodicReportSubtitle(enabled: boolean, frequency: PeriodicReportFrequency, recipients: string[]) {
  if (!enabled) return 'Apagado';
  const when = frequency === 'BIWEEKLY' ? 'Cada 15 días' : 'Cada mes';
  if (recipients.length === 0) return when;
  if (recipients.length === 1) return `${when} · ${recipients[0]}`;
  return `${when} · ${recipients.length} correos`;
}

export function PeriodicReportForm({ run, busy, error }: FormProps) {
  const { user, appSession } = useAppContext();
  const { close } = useDesk();
  const phone = usePhoneLayout();
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<PeriodicReportFrequency>('MONTHLY');
  const [recipients, setRecipients] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchPeriodicReport(user).then((settings) => {
      if (!active) return;
      setEnabled(settings.enabled);
      setFrequency(settings.frequency);
      const stored = settings.recipients.join(', ');
      setRecipients(stored || appSession?.store?.email || appSession?.user?.email || '');
      const bits = [settings.lastPeriodLabel ? `Último período enviado: ${settings.lastPeriodLabel}` : '', isNetworkErrorMessage(settings.lastError) ? '' : settings.lastError ?? ''].filter(Boolean);
      setNote(bits.join(' '));
      setLoaded(true);
    }).catch((cause: unknown) => {
      if (active) setLoadError(toUserMessage(cause, 'No se pudo cargar el reporte automático'));
    });
    return () => { active = false; };
  }, [user, appSession?.store?.email, appSession?.user?.email]);

  return (
    <Sheet title="Reporte automático" subtitle={phone ? 'Configuración' : 'Mismos números que Reportes. Se manda a la mañana, hora de Argentina, cuando cierra el período.'} className="cfg-sheet" onClose={close}>
      {loadError && !isNetworkErrorMessage(loadError) ? <p className="ferr" role="alert">{loadError}</p> : null}
      {error ? <p className="ferr" role="alert">{error}</p> : null}
      {phone ? <p className="sub">Mismos números que Reportes. Se manda a la mañana, hora de Argentina, cuando cierra el período.</p> : null}
      <Field label="Envío">
        <Segs options={[{ id: 'off', label: 'Apagado' }, { id: 'on', label: 'Encendido' }]} value={enabled ? 'on' : 'off'} onChange={(id) => setEnabled(id === 'on')} />
      </Field>
      <Field label="Frecuencia">
        <Segs options={[{ id: 'BIWEEKLY', label: 'Cada 15 días' }, { id: 'MONTHLY', label: 'Cada mes' }]} value={frequency} onChange={(id) => setFrequency(id === 'BIWEEKLY' ? 'BIWEEKLY' : 'MONTHLY')} />
      </Field>
      <Field label="Correos" error={fieldError}>
        <textarea data-testid="periodic-report-recipients" rows={3} value={recipients} disabled={!loaded || busy} placeholder="nombre@correo.com" onChange={(event) => { setRecipients(event.target.value); setFieldError(''); }} />
      </Field>
      {note ? <p className="sub" role="status">{note}</p> : null}
      {loaded ? null : <ListSkeleton variant="rows" rows={3} />}
      <Actions busy={busy} primary="Guardar" onSecondary={close} onPrimary={() => {
        if (!user || !loaded) return;
        const list = recipients.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
        if (enabled && list.length === 0) {
          setFieldError('Agregá al menos un correo.');
          return;
        }
        setFieldError('');
        void run(async () => {
          await savePeriodicReport(user, { enabled, frequency, recipients: list });
        }, enabled ? 'Reporte automático activado' : 'Reporte automático apagado');
      }} />
    </Sheet>
  );
}
