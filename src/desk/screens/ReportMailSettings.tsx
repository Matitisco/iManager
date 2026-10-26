import { useEffect, useId, useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { fetchPeriodicReport, savePeriodicReport, sendPeriodicReportTest, type PeriodicReportInput } from '../../services/periodic-report-api';
import { toUserMessage } from '../../lib/user-message';
import { ListSkeleton } from '../list-skeleton';
import { DeskSelect } from '../select';
import './report-mail.css';

const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const choices = [{ id: 'WEEKLY', label: 'Semanal' }, { id: 'BIWEEKLY', label: 'Cada 15 días' }, { id: 'MONTHLY', label: 'Mensual' }] as const;
function nextSend(draft: PeriodicReportInput, timezone: string) {
  if (!draft.enabled) return 'Apagado';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const part = (key: string) => parts.find(p => p.type === key)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const currentTime = `${part('hour')}:${part('minute')}`;
  for (let i = 0; i < 45; i++) {
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + i);
    const day = date.getUTCDate(); const weekday = date.getUTCDay() || 7;
    const scheduled = draft.frequency === 'WEEKLY' ? weekday === draft.sendDay : day === draft.sendDay || (draft.frequency === 'BIWEEKLY' && day === Math.min((draft.sendDay ?? 1) + 15, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
    if (scheduled && (i > 0 || currentTime < (draft.sendTime ?? '09:00'))) return `${weekdays[weekday - 1]} ${String(day).padStart(2, '0')}/${String(date.getUTCMonth()+1).padStart(2, '0')} · ${draft.sendTime}`;
  }
  return 'Revisá el horario';
}
export function ReportMailSettings() {
  const { user, appSession, backendStatus } = useAppContext();
  const id = useId();
  const [draft, setDraft] = useState<PeriodicReportInput>({ enabled: false, frequency: 'WEEKLY', sendDay: 1, sendTime: '09:00', recipients: [] });
  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const owner = appSession?.membership?.role === 'OWNER';
  const storeId = appSession?.store?.id;
  const ready = owner && !!storeId && !!user && backendStatus === 'ready' && !appSession?.onboardingRequired;
  useEffect(() => {
    setLoaded(false); setError(''); setNote('');
    if (!ready || !user) return;
    let active = true;
    void fetchPeriodicReport(user).then(settings => {
      if (!active) return;
      setDraft({ enabled: settings.enabled, frequency: settings.frequency, sendDay: settings.sendDay ?? 1, sendTime: settings.sendTime ?? '09:00', recipients: settings.recipients });
      setTimezone(settings.timezone ?? 'America/Argentina/Buenos_Aires');
      setNote(settings.lastError ?? ''); setLoaded(true);
    }).catch(cause => { if (active) setError(toUserMessage(cause, 'No se pudo cargar el reporte automático')); });
    return () => { active = false; };
  }, [ready, user, storeId]);
  const update = (change: Partial<PeriodicReportInput>) => { setDraft(value => ({ ...value, ...change })); setNote(''); setError(''); };
  const act = async (test = false) => {
    if (!ready || !user || !loaded || busy) return;
    setBusy(true); setError(''); setNote('');
    try {
      if (test) { const result = await sendPeriodicReportTest(user, draft); if (result.sent) setNote(result.message); else setError(result.message); }
      else { await savePeriodicReport(user, draft); setNote('Configuración guardada'); }
    } catch (cause) { setError(toUserMessage(cause, test ? 'No se pudo enviar el mail de prueba' : 'No se pudo guardar el reporte automático')); }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void act(); };
  const maxDay = draft.frequency === 'WEEKLY' ? 7 : draft.frequency === 'BIWEEKLY' ? 15 : 28;
  if (!owner) return null;
  return <section className="dcard report-mail-card" aria-label="Reporte por mail">
    <div className="dch"><h3>Reporte por mail</h3></div>
    <form id={id} onSubmit={submit}>
      <div className="report-mail-toggle"><b>Activar reporte por mail</b><button type="button" className="report-mail-switch" role="switch" aria-label="Activar reporte por mail" aria-checked={draft.enabled} disabled={!loaded || busy} onClick={() => update({ enabled: !draft.enabled })}><span className={`sw${draft.enabled ? ' on' : ''}`}><i /></span></button></div>
      {!loaded && !error ? <ListSkeleton variant="rows" rows={3} /> : null}
      <fieldset className="report-mail-controls" disabled={!loaded || busy}>
        <div className="fl"><span>Frecuencia</span><div className="sgs report-mail-frequency" role="group" aria-label="Frecuencia">{choices.map(c => <button key={c.id} type="button" className={`sg${draft.frequency === c.id ? ' on' : ''}`} aria-pressed={draft.frequency === c.id} onClick={() => update({ frequency: c.id, sendDay: 1 })}>{c.label}</button>)}</div></div>
        <div className="frow"><div className="fl"><span>{draft.frequency === 'BIWEEKLY' ? 'Día de cada quincena' : 'Día de envío'}</span><DeskSelect label="Día de envío" value={String(draft.sendDay ?? 1)} options={Array.from({ length: maxDay }, (_, i) => ({ value: String(i + 1), label: draft.frequency === 'WEEKLY' ? weekdays[i] : draft.frequency === 'BIWEEKLY' ? `${i + 1} y ${i + 16}` : `Día ${i + 1}` }))} onChange={v => update({ sendDay: Number(v) })} /></div>
        <label className="fl"><span title={timezone}>Hora · {timezone === 'America/Argentina/Buenos_Aires' ? 'Argentina' : timezone.split('/').pop()?.replaceAll('_', ' ')}</span><input aria-label="Hora de envío" type="text" inputMode="numeric" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" required value={draft.sendTime} onChange={e => update({ sendTime: e.target.value })} /></label></div>
        <label className="fl"><span>Mail destinatario</span><input aria-label="Mail destinatario" type="email" multiple autoComplete="email" required={draft.enabled} value={draft.recipients.join(', ')} onChange={e => update({ recipients: e.target.value.split(',').map(s => s.trim()) })} /></label>
      </fieldset>
      <div className="report-mail-next"><span>Próximo envío</span><b title={timezone}>{nextSend(draft, timezone)}</b></div>
      <div className="report-mail-actions"><button className="btn2 s report-mail-test" type="button" disabled={!loaded || busy} onClick={() => { const form = document.getElementById(id) as HTMLFormElement; if (form.reportValidity()) void act(true); }}><Mail size={18} />Enviar mail de prueba</button><button className="btn2 p report-mail-save" type="submit" disabled={!loaded || busy}>Guardar</button></div>
      {error ? <p className="ferr" role="alert">{error}</p> : null}
      {note ? <p className="report-mail-feedback" role="status">{note}</p> : null}
    </form>
    <div className="mdock report-mail-dock"><button className="dbtn p" form={id} type="submit" disabled={!loaded || busy}>Guardar</button></div>
  </section>;
}
