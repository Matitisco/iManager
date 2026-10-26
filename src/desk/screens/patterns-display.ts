/** Preserve the server's rounded percentages, but never hide a positive count. */
export function patternPercent({ percent, problems }: { percent: number; problems: number }) {
  return problems > 0 && percent === 0 ? '<1%' : `${percent}%`;
}

export function patternBarWidth(row: { percent: number; problems: number; devices: number }) {
  return `${row.problems > 0 ? Math.max(2, row.percent) : 0}%`;
}
