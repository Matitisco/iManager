import { ReplayValue } from './replay-privacy';
import { formatMoney } from './format';
import { projectAmount, type MoneyCurrency } from './money';

// Presentation only: callers keep using the stored amount for writes and receipts.
export function saleDetailAmounts(amount: number, source: MoneyCurrency, display: MoneyCurrency, secondary: MoneyCurrency | null, rate: number | null) {
  const validRate = rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
  const primary = projectAmount(amount, source, display, validRate, 2);
  const other = secondary ?? (source !== display ? source : null);
  const equivalent = other ? projectAmount(amount, source, other, validRate, 2) : null;
  return {
    primary: formatMoney(primary.value, primary.currency, 2),
    secondary: !primary.blocked && equivalent && !equivalent.blocked && equivalent.currency !== primary.currency
      ? formatMoney(equivalent.value, equivalent.currency, 2) : null,
  };
}

export function SaleDetailMoney({ amount, source, display, secondary, rate, prefix = '' }: {
  amount: number; source: MoneyCurrency; display: MoneyCurrency; secondary: MoneyCurrency | null; rate: number | null; prefix?: string;
}) {
  const values = saleDetailAmounts(amount, source, display, secondary, rate);
  return <span className="vsm-value"><b>{prefix}<ReplayValue>{values.primary}</ReplayValue></b>{values.secondary ? <small>≈ <ReplayValue>{values.secondary}</ReplayValue></small> : null}</span>;
}
