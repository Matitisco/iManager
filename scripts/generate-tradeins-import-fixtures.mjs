import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const outDir = path.resolve('docs/test-data/tradeins-import');
fs.mkdirSync(outDir, { recursive: true });

function writeWorkbook(filename, rows) {
  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Canjes');
  xlsx.writeFile(workbook, path.join(outDir, filename));
}

writeWorkbook('01-tradeins-import-validos-con-variaciones.xlsx', [
  {
    clientName: 'Juan Perez',
    date: '08 abr 2026',
    deviceReceived: 'iPhone 13 128GB Midnight',
    deviceReceivedImei: '359111111111111',
    takeValue: '425000',
    deviceGiven: 'iPhone 15 128GB Blue',
    differencePaid: '210000',
    status: 'PENDIENTE',
    batteryHealth: '87%',
    grade: 'A',
  },
  {
    clientName: 'Ana Gomez',
    date: '2026-04-08',
    deviceReceived: 'Samsung S23 256GB',
    deviceReceivedImei: '359222222222222',
    takeValue: '390000.50',
    deviceGiven: 'iPhone 14 128GB',
    differencePaid: '150000.75',
    status: 'APROBADO',
    batteryHealth: '83-85%',
    grade: 'A-',
  },
  {
    clientName: 'Carlos Lopez',
    date: '',
    deviceReceived: 'Moto Edge 40 Neo',
    deviceReceivedImei: '359333333333333',
    takeValue: '210000',
    deviceGiven: 'Samsung A55',
    differencePaid: '50000',
    status: '',
    batteryHealth: '',
    grade: '',
  },
]);

writeWorkbook('02-tradeins-import-mixto-errores.xlsx', [
  {
    clientName: 'Cliente Inexistente',
    date: '08 abr 2026',
    deviceReceived: 'iPhone XR',
    deviceReceivedImei: '358000000000001',
    takeValue: '120000',
    deviceGiven: 'iPhone 13',
    differencePaid: '300000',
    status: 'PENDIENTE',
    batteryHealth: '79%',
    grade: 'B',
  },
  {
    clientName: 'Juan Perez',
    date: '08 abr 2026',
    deviceReceived: '',
    deviceReceivedImei: '358000000000002',
    takeValue: '110000',
    deviceGiven: 'Samsung S24',
    differencePaid: '250000',
    status: 'LISTO',
    batteryHealth: '81%',
    grade: 'B+',
  },
  {
    clientName: 'Juan Perez',
    date: '08 abr 2026',
    deviceReceived: 'Samsung S21',
    deviceReceivedImei: '',
    takeValue: '100000',
    deviceGiven: 'Samsung S24',
    differencePaid: '250000',
    status: 'LISTO',
    batteryHealth: '81%',
    grade: 'B+',
  },
  {
    clientName: 'Juan Perez',
    date: '08 abr 2026',
    deviceReceived: 'Samsung S20 FE',
    deviceReceivedImei: '358000000000004',
    takeValue: '-5000',
    deviceGiven: 'Samsung S24',
    differencePaid: '250000',
    status: 'LISTO',
    batteryHealth: '81%',
    grade: 'B+',
  },
  {
    clientName: 'Juan Perez',
    date: '08 abr 2026',
    deviceReceived: 'Moto G84',
    deviceReceivedImei: '358000000000005',
    takeValue: '100000',
    deviceGiven: 'Samsung S24',
    differencePaid: 'no-numero',
    status: 'LISTO',
    batteryHealth: '81%',
    grade: 'B+',
  },
  {
    clientName: 'Juan Perez',
    date: '08 abr 2026',
    deviceReceived: 'iPhone 11',
    deviceReceivedImei: '358000000000006',
    takeValue: '180000',
    deviceGiven: '',
    differencePaid: '120000',
    status: 'LISTO',
    batteryHealth: '81%',
    grade: 'B+',
  },
]);

writeWorkbook('03-tradeins-import-duplica-y-upsertea.xlsx', [
  {
    clientName: 'Juan Perez',
    date: '08 abr 2026',
    deviceReceived: 'iPhone 12 64GB Black',
    deviceReceivedImei: '357777777777777',
    takeValue: '240000',
    deviceGiven: 'iPhone 15 128GB',
    differencePaid: '280000',
    status: 'PENDIENTE',
    batteryHealth: '82%',
    grade: 'B',
  },
  {
    clientName: 'Juan Perez',
    date: '09 abr 2026',
    deviceReceived: 'iPhone 12 64GB Black',
    deviceReceivedImei: '357777777777777',
    takeValue: '255000',
    deviceGiven: 'iPhone 15 128GB Pink',
    differencePaid: '265000',
    status: 'APROBADO',
    batteryHealth: '84%',
    grade: 'B+',
  },
  {
    clientName: 'Ana Gomez',
    date: '10 abr 2026',
    deviceReceived: 'iPhone 12 64GB Black',
    deviceReceivedImei: '357777777777777',
    takeValue: '260000',
    deviceGiven: 'iPhone 15 256GB Pink',
    differencePaid: '300000',
    status: 'LISTO',
    batteryHealth: '85%',
    grade: 'A-',
  },
]);

writeWorkbook('04-tradeins-import-headers-confusos.xlsx', [
  {
    Cliente: 'Juan Perez',
    Fecha: '08 abr 2026',
    'Equipo recibido': 'iPhone 13 Pro',
    IMEI: '356666666666666',
    'Valor toma': '500000',
    Entrega: 'iPhone 16 Pro',
    Diferencia: '350000',
    Estado: 'PERITAJE TÉC.',
    Bateria: '89%',
    Grado: 'A',
  },
  {
    Cliente: 'Ana Gomez',
    Fecha: '08 abr 2026',
    Modelo: 'Samsung S24 Ultra',
    'IMEI recibido': '356666666666667',
    Tomado: '610000',
    'Equipo entregado': 'iPhone 16 Pro Max',
    'Diferencia abonada': '440000',
    Estado: 'RECHAZADO',
    'Salud bateria': 'N/A',
    Grade: 'A',
  },
]);

writeWorkbook('05-tradeins-import-formatos-extremos.xlsx', [
  {
    clientName: ' Juan Perez ',
    date: '   8   abr.   2026   ',
    deviceReceived: 'Pixel 8 Pro',
    deviceReceivedImei: '355555555555551',
    takeValue: ' 450000 ',
    deviceGiven: ' iPhone 15 Pro ',
    differencePaid: ' 199999.99 ',
    status: 'aprobado',
    batteryHealth: ' 90 % ',
    grade: ' A ',
  },
  {
    clientName: 'Ana Gomez',
    date: 'ayer',
    deviceReceived: 'Xiaomi 13T',
    deviceReceivedImei: '355555555555552',
    takeValue: '320000,50',
    deviceGiven: 'Samsung S24',
    differencePaid: '180000,25',
    status: 'estado-raro',
    batteryHealth: '83-85%',
    grade: 'B / B+',
  },
  {
    clientName: 'Carlos Lopez',
    date: '2026/04/08',
    deviceReceived: 'Nothing Phone 2',
    deviceReceivedImei: '355555555555553',
    takeValue: '0',
    deviceGiven: 'Moto Edge 50',
    differencePaid: '0',
    status: 'LISTO',
    batteryHealth: 'SIN DATO',
    grade: 'N/A',
  },
]);

console.log(`Fixtures generated in ${outDir}`);
