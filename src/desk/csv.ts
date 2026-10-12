export function csvText(rows: string[][]) {
  return rows.map((row) => row.map((cell) => {
    // Quoting alone does not prevent spreadsheet formula execution.
    const safe = /^[\s]*[=+@-]/.test(cell) ? `'${cell}` : cell;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',')).join('\n');
}

export function downloadCsv(rows: string[][], filename: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', csvText(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Keep the blob alive until the browser has consumed the click.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
