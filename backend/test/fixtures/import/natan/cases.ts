/** Explicit expectations for anonymized source files. Column indices are physical, zero based. */
const core = { 0: 'entryDate', 1: 'supplierName', 2: 'model', 3: 'capacity', 4: 'batteryHealth', 5: 'imei', 7: 'color', 8: 'cost', 9: 'batteryNote', 10: 'status' };
const headers = { ...core, 1: 'supplierName', 6: 'custom:calidad_origen' };
export const natanCases = [
  { file: '00_natan_anon', header: 0, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: core },
  { file: '01_hoja_extra', header: 0, detected: 63, accepted: 59, reasons: { duplicate: 1, excluded_sheet: 3 }, mapping: core },
  { file: '02_encabezado_corrido', header: 4, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: headers },
  { file: '03_columnas_vacias', header: 0, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: { 0: 'entryDate', 1: 'supplierName', 2: 'model', 4: 'capacity', 5: 'batteryHealth', 6: 'imei', 8: 'color', 10: 'cost', 11: 'batteryNote', 12: 'status' } },
  { file: '04_otro_orden_con_encabezado', header: 1, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: { 0: 'model', 1: 'imei', 2: 'capacity', 3: 'color', 4: 'cost', 5: 'batteryHealth', 6: 'custom:calidad_origen', 7: 'status', 8: 'entryDate', 9: 'supplierName', 10: 'batteryNote' } },
  { file: '05_capacidades_mixtas', header: 0, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: core },
  { file: '06_bateria_mezclada', header: 0, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: core },
  { file: '07_minusculas_espacios', header: 0, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: core },
  { file: '08_imeis_raros', header: 0, detected: 60, accepted: 54, reasons: { duplicate: 3, invalid_imei: 3 }, mapping: core },
  { file: '09_celdas_raras', header: 0, detected: 60, accepted: 51, reasons: { invalid_price: 4, missing_model: 2, invalid_row: 2, duplicate: 1 }, mapping: core },
  { file: '10_blancos_y_total', header: 0, detected: 65, accepted: 59, reasons: { empty: 4, duplicate: 1, footer: 1 }, mapping: core },
  { file: '11_celdas_combinadas', header: 0, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: core },
  { file: '14_csv_puntoycoma', header: 1, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: headers },
  { file: '15_encabezado_informal', header: 1, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: { ...headers, 6: 'custom:condicion_origen' } },
  { file: '16_sin_columnas_venta', header: 0, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: core },
  { file: '17_solo_encabezado', header: 1, detected: 0, accepted: 0, reasons: {}, mapping: { 0: 'entryDate', 1: 'supplierName', 2: 'model', 3: 'capacity', 4: 'batteryHealth', 5: 'imei', 6: 'grade', 7: 'color', 8: 'cost', 9: 'batteryNote', 10: 'status' } },
  { file: '18_con_precio_venta', header: 1, detected: 60, accepted: 59, reasons: { duplicate: 1 }, mapping: { ...headers, 9: 'price', 10: 'batteryNote', 11: 'status' } },
];
