import { summarizeSaleProfit } from './sale-profit';
import type { MoneyCurrency } from './money';

/** Amount is the full outgoing price, including any value taken in a trade-in. */
export function saleCostPreview(input: {
  amount: number; cost: number; cantidad: number;
  currency: MoneyCurrency; costCurrency?: string | null; rate: number | null;
}) {
  const summary = summarizeSaleProfit([{
    id: 'preview', productId: 'equipment', clientId: '', date: '',
    amount: input.amount, amountCurrency: input.currency, cantidad: input.cantidad,
    status: 'COMPLETADA', paymentMethod: '',
  }], [{ id: 'equipment', cost: input.cost, currency: input.costCurrency }], input.currency, input.rate);
  return {
    profit: summary.salesWithoutCost ? null : summary.grossProfit,
    marginPct: summary.salesWithoutCost ? null : summary.marginPct,
  };
}
