
// Entirely fabricated data, generated in memory. No external spreadsheet is read.
export function syntheticStockRows(count = 60): string[][] {
  return Array.from({ length: count }, (_, i) => [
    i % 4 === 0 ? `${i % 28 + 1}/10` : new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
    ['PROV1', 'CANJE/xx', 'REINGRESO'][i % 3],
    i % 3 === 0 ? 'iPhone 13' : `iPhone ${12 + i % 5} Pro Max`,
    ['128GB', '256GB', '512GB'][i % 3],
    i === 7 ? '8*%' : String((80 + i % 20) / 100),
    String(990000000000000 + i),
    ['A', 'A-', 'AA', 'AB', ''][i % 5],
    ['Black', 'White', 'Blue', 'Midnight', 'Silver'][i % 5],
    i === 9 ? 'abc' : String(300 + i * 10),
    i % 2 || i === 4 ? 'BATERIA' : '',
    ['DISPONIBLE', 'VENDIDO', 'SIN SERVICIO', 'SERVICIO TECNICO'][i % 4],
    i ? '=IFERROR(A2+1,"")' : '',
    i ? 'CABLE FICTICIO' : '',
    i ? `Cliente Falso ${i}` : '',
    i ? `99,000,${String(i).padStart(3, '0')}` : '',
    i ? String(1100000000 + i) : '',
  ]);
}

// Same failure shape as the reported model output, with fabricated cell values:
// row 5 is a product, repairs are mapped to battery, and actual health is ignored.
export function mistakenStockPlan(rows = syntheticStockRows()) {
  const fields = ['purchasedAt', '', 'model', 'capacity', '', 'imei', '', 'color', 'cost', 'batteryHealth', 'status', '', '', '', '', ''];
  return {
    sheets: [{
      name: 'stock de equipos', include: true, condition: '' as const,
      headerRow: 5, dataStartRow: 6, dataEndRow: 30,
      mapping: rows[4].map((header, index) => ({ header, field: fields[index] })),
      splitModelCapacity: false, batteryAsPercent: false, priceCurrency: '' as const,
    }],
  };
}

export function stockModelResponse(plan: unknown) {
  return new Response(JSON.stringify({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(plan) }] }],
    usage: { input_tokens: 4000, output_tokens: 900 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
