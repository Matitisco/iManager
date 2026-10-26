/** Preserve the server's rounded percentages, but never hide a positive count. */
export function patternPercent({ percent, problems }: { percent: number; problems: number }) {
  return problems > 0 && percent === 0 ? '<1%' : `${percent}%`;
}

export function patternBarWidth(row: { percent: number; problems: number; devices: number }) {
  return `${row.percent === 0 && row.problems > 0 && row.devices > 0 ? row.problems / row.devices * 100 : row.percent}%`;
}
