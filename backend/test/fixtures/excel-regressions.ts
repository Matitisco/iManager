// Minimal synthetic cases from the offline evaluation. No real spreadsheets.
type Cell = string | number;
const models = ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 14', 'iPhone 14 Pro', 'iPhone 15', 'iPhone XR', 'iPhone 12 Pro', 'iPhone 15 Pro'];
const capacities = ['64', '128', '256', '128', '256', '128', '256', '64', '128', '256'];
const colors = ['Negro', 'Blanco', 'Azul', 'Verde', 'Rojo', 'Negro', 'Titanio', 'Blanco', 'Grafito', 'Natural'];
const imeiOf = (i: number) => `35678901${String(234000 + i).padStart(7, '0')}`;
const cost = (i: number) => 250 + i * 37;
const header = ['Modelo', 'Capacidad', 'Batería', 'IMEI', 'Color', 'Costo'];
export const regressionFields = ['model', 'capacity', 'batteryHealth', 'imei', 'color', 'cost'];
const row = (i: number): Cell[] => [models[i], capacities[i], 80 + ((i * 3) % 19), imeiOf(i), colors[i], cost(i)];
const base = (count = 10) => Array.from({ length: count }, (_, i) => row(i));

export function excelRegressionFixtures() {
  const duplicate = base();
  duplicate[6][3] = imeiOf(2);
  duplicate[9][3] = imeiOf(5);
  const merged = base(9);
  merged.forEach((r, index) => { r[0] = ['iPhone 13', 'iPhone 13', 'iPhone 13', 'iPhone 14', 'iPhone 14', 'iPhone 14', 'iPhone 14', 'iPhone 12', 'iPhone 12'][index]; });
  const scientific = base();
  scientific.forEach((r, i) => { if (i < 4) r[3] = '3.56789E+14'; else if (i % 2) r[3] = Number(imeiOf(i)); });
  return [
    { name: '09_repeated_imei', rows: [header, ...duplicate], merges: [], accepted: 10, rejected: [] },
    { name: '10_merged_cells', rows: [header, ...merged], merges: ['A2:A4', 'A5:A8', 'A9:A10'], accepted: 9, rejected: [] },
    { name: '11_totals_footer', rows: [header, ...base(), [], ['TOTAL', '', '', '', '', Array.from({ length: 10 }, (_, i) => cost(i)).reduce((a, b) => a + b, 0)], ['Stock total:', 10], ['Nota: los equipos A-/B se revisan el viernes']], merges: [], accepted: 13, rejected: [] },
    { name: '13_sci_imei', rows: [header, ...scientific], merges: [], accepted: 10, rejected: [] },
  ];
}
