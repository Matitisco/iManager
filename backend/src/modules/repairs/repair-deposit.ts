export const DEPOSIT_OVER_ESTIMATE = "La seña no puede superar el presupuesto";

export function depositExceedsEstimate(estimate: number | null | undefined, deposit: number | null | undefined) {
  if (estimate == null) return false;
  return (deposit ?? 0) > estimate;
}
