import ExcelJS from 'exceljs';

const synthetic = [
  ['Fecha', 'Cliente', 'Equipo', 'IMEI', 'Precio ARS', 'Moneda', 'Pago', 'Notas', 'Referencia de caja', ''],
  ['10/01/2024', 'Cliente ficticio A', 'Equipo de prueba', '990000000000101', '500000', 'ARS', 'Transferencia', 'Con funda', 'CAJA-QA-1', 'valor sin título'],
  ['10/01/2024', 'Cliente ficticio A', 'Equipo de prueba', '990000000000101', '500000', 'ARS', 'Transferencia', 'Con funda', 'CAJA-QA-1', 'valor sin título'],
  ['11/01/2024', 'Cliente ficticio B', 'Otro equipo', '990000000000102', '900000', 'ARS', '', 'Pago a revisar', 'CAJA-QA-2'],
  ['TOTAL', '', '', '', '1900000', 'ARS'],
  [],
  ['', '', '', '', '', '', '', '', 'Llamar mañana'],
  ['31/02/2024', 'Cliente ficticio C', 'Equipo QA', 'incompleto', 'consultar', 'USD', 'desconocido', 'Nota intacta'],
];

export async function inventedSalesWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Ventas ficticias').addRows(synthetic);
  const buffer = await workbook.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buffer);
  return read.worksheets.map(sheet => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, row => {
      rows.push(Array.from({ length: sheet.columnCount }, (_, index) => row.getCell(index + 1).text));
    });
    return { name: sheet.name, rows };
  });
}
