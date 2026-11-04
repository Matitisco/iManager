import { Field } from './ui';
import { formatMoneyInput } from './format';
import { receiptMoney } from './overlays/deposits';
import { saleCostPreview } from './sale-cost-preview';
import type { MoneyCurrency } from './money';

export function SaleCostField({ visible, value, onChange, cost, amount, cantidad, currency, costCurrency, rate, busy }: {
  visible: boolean; value: string; onChange: (value: string) => void;
  cost: number; amount: number; cantidad: number; currency: MoneyCurrency;
  costCurrency: MoneyCurrency; rate: number | null; busy: boolean;
}) {
  if (!visible) return null;
  const preview = saleCostPreview({ amount, cost, cantidad, currency, costCurrency, rate });
  return <>
    <Field label="Costo del equipo" mark={costCurrency}>
      <input value={value} disabled={busy} inputMode="decimal"
        onChange={event => onChange(formatMoneyInput(event.target.value))} placeholder="$ 0" />
    </Field>
    {cantidad > 1 ? <p className="eqs-note">Costo por unidad.</p> : null}
    <p data-ph-mask className="op-summary sale-cost-profit">
      <span>Ganancia</span>
      <output aria-label="Ganancia" aria-live="polite" className={preview.profit != null && preview.profit < 0 ? 'negative' : undefined}>
        <strong>{preview.profit == null ? '—' : `${receiptMoney(preview.profit, currency)} · ≈ ${preview.marginPct} %`}</strong>
      </output>
    </p>
  </>;
}
