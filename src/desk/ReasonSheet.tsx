import { useState } from 'react';
import { Actions, Sheet } from './ui';

const REASONS = ['Error de carga', 'Duplicado', 'Devolución', 'Otro'];

export function ReasonSheet({ title, subtitle, note, ok, cancel = 'Cancelar', className, danger, busy, error, extra, onClose, onOk }: {
  title: string;
  subtitle?: string;
  note: string;
  ok: string;
  cancel?: string;
  className?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  extra?: { label: string; onClick: () => void } | null;
  onClose: () => void;
  onOk: (reason: string) => void;
}) {
  const [chip, setChip] = useState('');
  const [detail, setDetail] = useState('');
  const reason = [chip === 'Otro' ? '' : chip, detail.trim()].filter(Boolean).join(' · ').slice(0, 280);
  return <Sheet className={className} title={title} subtitle={subtitle} onClose={onClose} busy={busy} footer={<Actions primary={ok} secondary={cancel} danger={danger} busy={busy} onPrimary={() => onOk(reason)} onSecondary={onClose} />}>
    <div className="pending-sale"><div><b>Qué pasa</b><small>{note}</small></div></div>
    <p className="kicker">Motivo (opcional)</p>
    <div className="wchips">{REASONS.map((label) => <button key={label} type="button" className={`wchip${chip === label ? ' on' : ''}`} disabled={busy} aria-pressed={chip === label} onClick={() => setChip(current => current === label ? '' : label)}>{label}</button>)}</div>
    <textarea disabled={busy} aria-label="Detalle" maxLength={280} value={detail} placeholder="Agregá un detalle si querés" onChange={(event) => setDetail(event.target.value)} />
    <p className="mut">{detail.length}/280</p>
    {extra ? <button type="button" className="wlink" disabled={busy} onClick={extra.onClick}>{extra.label}</button> : null}
    {error ? <p className="ferr" role="alert">{error}</p> : null}
  </Sheet>;
}
