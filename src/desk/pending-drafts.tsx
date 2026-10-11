import type { TradeIn } from '../types';

export function PendingDrafts({
  drafts,
  hint,
  compact = false,
  onOpen,
}: {
  drafts: Pick<TradeIn, 'id' | 'clientName' | 'deviceReceived'>[];
  hint: string;
  compact?: boolean;
  onOpen: (id: string) => void;
}) {
  if (drafts.length === 0) return null;
  return (
    <div className={`dcard op-drafts${compact ? ' compact' : ''}`}>
      <div><b>Canjes pendientes de confirmar</b><small>{hint}</small></div>
      <div className="op-draft-list">{drafts.map((trade) => (
        <button key={trade.id} type="button" onClick={() => onOpen(trade.id)}>
          <span>{trade.clientName || 'Cliente por completar'} · {trade.deviceReceived || 'Equipo recibido'}</span><b>Retomar</b>
        </button>
      ))}</div>
    </div>
  );
}
