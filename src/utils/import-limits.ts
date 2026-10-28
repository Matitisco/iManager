export type ImportGrid = { name: string; rows: string[][] };

/** Normalize harmless Excel padding before enforcing the API's physical-grid limits. */
export function prepareImportSheets(sheets: ImportGrid[]): ImportGrid[] {
  const prepared = sheets.map(sheet => {
    let end = sheet.rows.length;
    while (end > 0 && sheet.rows[end - 1].every(cell => !cell.trim())) end--;
    const rows = sheet.rows.slice(0, end);
    let width = 0;
    for (const row of rows) for (let i = row.length - 1; i >= width; i--) {
      if (row[i]?.trim()) { width = i + 1; break; }
    }
    if (!width) return null;
    if (rows.length > 5000) throw new Error(`El archivo tiene más de 5000 filas en la hoja ${sheet.name}. Dividilo en partes.`);
    if (width > 40) throw new Error(`La hoja ${sheet.name} tiene más de 40 columnas con datos. Quitá las que no necesitás.`);
    if (!sheet.name.trim() || sheet.name.trim().length > 80) throw new Error('Los nombres de las hojas deben tener entre 1 y 80 caracteres.');
    return { name: sheet.name, rows: rows.map(row => row.slice(0, width).map(cell => cell.trim().slice(0, 2000))) };
  }).filter((sheet): sheet is ImportGrid => sheet !== null);
  if (prepared.length > 12) throw new Error('El archivo tiene más de 12 hojas con datos. Dividilo en archivos más chicos.');
  if (!prepared.length) throw new Error('El archivo no tiene datos para importar.');
  return prepared;
}
