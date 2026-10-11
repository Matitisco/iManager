import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function save(dir, name, currency, sheets, rows, extra = {}) {
  const folder = path.join(root, dir);
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, `${name}.grid.json`), JSON.stringify(sheets));
  writeFileSync(path.join(folder, `${name}.expected.json`), JSON.stringify({
    section: dir === "import-sales" ? "sales" : "clients",
    currency,
    rows,
    ...extra,
  }, null, 1));
}

const saleHead = ["Fecha", "Cliente", "Equipo", "IMEI", "Precio", "Moneda", "Pago", "Canje", "Vendedor"];

save("import-sales", "s1_mostrador", "ARS", [
  { name: "Ventas octubre", rows: [
    saleHead,
    ["12/10/2026", "Ana Gómez", "iPhone 13 128 GB", "353456789012345", "1250000", "ARS", "Efectivo", "-", "Luis"],
    ["11/10/2026", "Bruno Díaz", "iPhone 14 Pro 256 GB", "359876543210987", "980", "USD", "Transferencia", "iPhone 11 64 GB", "Mica"],
    ["10/10/2026", "Carla Ruiz", "iPhone 12 128 GB", "351112223334455", "890000", "ARS", "Tarjeta", "", "Sofía"],
    ["09/10/2026", "Diego Paz", "iPhone 15 128 GB", "354000111222333", "2100000", "pesos", "Mercado Pago", "sin canje", "Luis"],
    ["08/10/2026", "Elena Soto", "iPhone 13 Pro 256 GB", "357777888899900", "1100", "u$d", "débito", "iPhone XR", "Mica"],
    ["07/10/2026", "Fabián Luna", "iPhone 11 64 GB", "350101202303404", "450000", "ARS", "T. Crédito", "", "Sofía"],
  ] },
], [
  { date: "12/10/2026", clientName: "Ana Gómez", device: "iPhone 13 128 GB", productImei: "353456789012345", amount: "1250000", currency: "ARS", paymentMethod: "EFECTIVO", tradeIn: "", seller: "Luis" },
  { date: "11/10/2026", clientName: "Bruno Díaz", device: "iPhone 14 Pro 256 GB", productImei: "359876543210987", amount: "980", currency: "USD", paymentMethod: "TRANSFERENCIA", tradeIn: "iPhone 11 64 GB", seller: "Mica" },
  { date: "10/10/2026", clientName: "Carla Ruiz", device: "iPhone 12 128 GB", productImei: "351112223334455", amount: "890000", currency: "ARS", paymentMethod: "TARJETA", tradeIn: "", seller: "Sofía" },
  { date: "09/10/2026", clientName: "Diego Paz", device: "iPhone 15 128 GB", productImei: "354000111222333", amount: "2100000", currency: "ARS", paymentMethod: "TRANSFERENCIA", tradeIn: "", seller: "Luis" },
  { date: "08/10/2026", clientName: "Elena Soto", device: "iPhone 13 Pro 256 GB", productImei: "357777888899900", amount: "1100", currency: "USD", paymentMethod: "TARJETA", tradeIn: "iPhone XR", seller: "Mica" },
  { date: "07/10/2026", clientName: "Fabián Luna", device: "iPhone 11 64 GB", productImei: "350101202303404", amount: "450000", currency: "ARS", paymentMethod: "T. Crédito", tradeIn: "", seller: "Sofía" },
]);

save("import-sales", "s2_encabezado_corrido", "ARS", [
  { name: "Usados vendidos", rows: [
    ["iSTORE PALERMO — VENTAS DE USADOS"],
    ["Actualizado 10/10. Consultar stock por WhatsApp"],
    [],
    ["", "Fecha", "Cliente", "Equipo", "IMEI", "Precio", "Moneda", "Pago", "Canje", "Vendedor"],
    ["", "06/10/2026", "Gonzalo Pérez", "iPhone 14 128 GB", "353 111 222 333 444", "$ 1.050.000", "ARS", "efectivo", "-", "Luis"],
    ["", "05/10/2026", "Helena Quiroga", "iPhone 13 mini 128 GB", "359000111222333", "u$s 640", "USD", "transferencia", "iPhone 8", "Mica"],
    [],
    [],
    ["", "04/10/2026", "Iván Rojas", "iPhone 12 Pro 128 GB", "351234567890123", "780000", "ARS", "tarjeta", "", "Sofía"],
    ["", "Precios de mostrador. No incluye funda."],
  ] },
], [
  { date: "06/10/2026", clientName: "Gonzalo Pérez", device: "iPhone 14 128 GB", productImei: "353111222333444", amount: "1050000", currency: "ARS", paymentMethod: "EFECTIVO", tradeIn: "", seller: "Luis" },
  { date: "05/10/2026", clientName: "Helena Quiroga", device: "iPhone 13 mini 128 GB", productImei: "359000111222333", amount: "640", currency: "USD", paymentMethod: "TRANSFERENCIA", tradeIn: "iPhone 8", seller: "Mica" },
  { date: "04/10/2026", clientName: "Iván Rojas", device: "iPhone 12 Pro 128 GB", productImei: "351234567890123", amount: "780000", currency: "ARS", paymentMethod: "TARJETA", tradeIn: "", seller: "Sofía" },
]);

const blockHead = ["Fecha", "Cliente", "Equipo", "IMEI", "Precio", "Moneda", "Pago", "Canje", "Vendedor"];
save("import-sales", "s3_varias_tablas", "ARS", [
  { name: "Resumen", rows: [
    ["Resumen octubre"],
    ["Mes", "Ventas", "Ganancia"],
    ["Octubre", "42", "8500000"],
  ] },
  { name: "Ventas", rows: [
    ["VENTAS EN EFECTIVO"],
    blockHead,
    ["03/10/2026", "Julia Méndez", "iPhone 15 Pro 256 GB", "354444555566677", "2400000", "ARS", "Efectivo", "-", "Luis"],
    ["02/10/2026", "Kevin Acosta", "iPhone 14 256 GB", "358888999900011", "1300000", "ARS", "Efectivo", "", "Mica"],
    [],
    ["VENTAS CON TRANSFERENCIA"],
    blockHead,
    ["01/10/2026", "Laura Benítez", "iPhone 16 128 GB", "352222333344455", "2800000", "ARS", "Transferencia", "iPhone 12", "Sofía"],
    ["30/09/2026", "Martín Correa", "iPhone 13 256 GB", "356666777788899", "1150000", "ARS", "Transferencia", "-", "Luis"],
    [],
    ["TOTAL", "", "", "", "7650000", "", "", "", ""],
  ] },
], [
  { date: "03/10/2026", clientName: "Julia Méndez", device: "iPhone 15 Pro 256 GB", productImei: "354444555566677", amount: "2400000", currency: "ARS", paymentMethod: "EFECTIVO", tradeIn: "", seller: "Luis" },
  { date: "02/10/2026", clientName: "Kevin Acosta", device: "iPhone 14 256 GB", productImei: "358888999900011", amount: "1300000", currency: "ARS", paymentMethod: "EFECTIVO", tradeIn: "", seller: "Mica" },
  { date: "01/10/2026", clientName: "Laura Benítez", device: "iPhone 16 128 GB", productImei: "352222333344455", amount: "2800000", currency: "ARS", paymentMethod: "TRANSFERENCIA", tradeIn: "iPhone 12", seller: "Sofía" },
  { date: "30/09/2026", clientName: "Martín Correa", device: "iPhone 13 256 GB", productImei: "356666777788899", amount: "1150000", currency: "ARS", paymentMethod: "TRANSFERENCIA", tradeIn: "", seller: "Luis" },
]);

save("import-sales", "s4_monedas_fechas", "ARS", [
  { name: "Caja", rows: [
    ["TECNO ROSARIO — CAJA"],
    ["Fecha", "Cliente", "Equipo", "IMEI", "Precio", "Pago", "Canje", "Vendedor"],
    ["2026-10-12", "Nina Ferreyra", "iPhone 14 Pro Max 256 GB", "351010203040506", "$ 1.850.000", "efectivo", "-", "Luis"],
    ["7/10/26", "Omar Vidal", "iPhone 13 128 GB", "359191929393949", "u$s 720", "transferencia", "iPhone 7", "Mica"],
    ["03.10.2026", "Paula Ibáñez", "iPhone 12 64 GB", "354545656767878", "900 dls", "tarjeta", "", "Sofía"],
    ["3-oct-2026", "Ramiro Costa", "iPhone 15 256 GB", "357070808090901", "ARS 2200000", "Mercado Pago", "sin canje", "Luis"],
    ["01-10-2026", "Sara Molina", "iPhone 11 Pro 64 GB", "353232424252626", "480000", "débito", "", "Mica"],
  ] },
], [
  { date: "12/10/2026", clientName: "Nina Ferreyra", device: "iPhone 14 Pro Max 256 GB", productImei: "351010203040506", amount: "1850000", currency: "ARS", paymentMethod: "EFECTIVO", tradeIn: "", seller: "Luis" },
  { date: "07/10/2026", clientName: "Omar Vidal", device: "iPhone 13 128 GB", productImei: "359191929393949", amount: "720", currency: "USD", paymentMethod: "TRANSFERENCIA", tradeIn: "iPhone 7", seller: "Mica" },
  { date: "03/10/2026", clientName: "Paula Ibáñez", device: "iPhone 12 64 GB", productImei: "354545656767878", amount: "900", currency: "USD", paymentMethod: "TARJETA", tradeIn: "", seller: "Sofía" },
  { date: "03/10/2026", clientName: "Ramiro Costa", device: "iPhone 15 256 GB", productImei: "357070808090901", amount: "2200000", currency: "ARS", paymentMethod: "TRANSFERENCIA", tradeIn: "", seller: "Luis" },
  { date: "01/10/2026", clientName: "Sara Molina", device: "iPhone 11 Pro 64 GB", productImei: "353232424252626", amount: "480000", currency: "ARS", paymentMethod: "TARJETA", tradeIn: "", seller: "Mica" },
]);

save("import-sales", "s5_abreviado", "USD", [
  { name: "Planilla vendedores", rows: [
    ["Día", "Comprador", "Modelo", "Serie", "Importe USD", "Medio", "Permuta", "Vend"],
    ["06/10/2026", "Tomás Alegre", "iPhone 16 Pro 256 GB", "351919293949596", "1450", "transferencia", "iPhone 13", "Luis"],
    ["05/10/2026", "Uma Brest", "iPhone 14 128 GB", "358080706050403", "690", "efectivo", "-", "Mica"],
    ["04/10/2026", "Vera Nieto", "iPhone 13 Pro Max 128 GB", "354321098765432", "810", "tarjeta", "iPhone XR 64", "Sofía"],
  ] },
], [
  { date: "06/10/2026", clientName: "Tomás Alegre", device: "iPhone 16 Pro 256 GB", productImei: "351919293949596", amount: "1450", currency: "USD", paymentMethod: "TRANSFERENCIA", tradeIn: "iPhone 13", seller: "Luis" },
  { date: "05/10/2026", clientName: "Uma Brest", device: "iPhone 14 128 GB", productImei: "358080706050403", amount: "690", currency: "USD", paymentMethod: "EFECTIVO", tradeIn: "", seller: "Mica" },
  { date: "04/10/2026", clientName: "Vera Nieto", device: "iPhone 13 Pro Max 128 GB", productImei: "354321098765432", amount: "810", currency: "USD", paymentMethod: "TARJETA", tradeIn: "iPhone XR 64", seller: "Sofía" },
]);

save("import-sales", "s6_basura", "ARS", [
  { name: "Hoja1", rows: [
    ["", "", "NO PASAR ESTA LISTA"],
    [],
    ["Fecha", "Cliente", "Equipo", "IMEI", "Precio", "Moneda", "Pago", "Canje", "Vendedor"],
    ["02/10/2026", "Wendy Salas", "iPhone 12 mini 128 GB", "359595858584848", "620000", "ARS", "Efectivo", "-", "Luis"],
    ["nota", "llamar al cliente mañana", "", "", "", "", "", "", ""],
    [],
    ["01/10/2026", "Xavier Duarte", "iPhone 15 Plus 128 GB", "351122334455667", "1900000", "ARS", "Transferencia", "", "Mica"],
    ["TOTAL", "", "", "", "2520000", "", "", "", ""],
    ["consultar stock de fundas"],
  ] },
], [
  { date: "02/10/2026", clientName: "Wendy Salas", device: "iPhone 12 mini 128 GB", productImei: "359595858584848", amount: "620000", currency: "ARS", paymentMethod: "EFECTIVO", tradeIn: "", seller: "Luis" },
  { date: "01/10/2026", clientName: "Xavier Duarte", device: "iPhone 15 Plus 128 GB", productImei: "351122334455667", amount: "1900000", currency: "ARS", paymentMethod: "TRANSFERENCIA", tradeIn: "", seller: "Mica" },
]);

save("import-sales", "n_gastos", "ARS", [
  { name: "Gastos local", rows: [
    ["Fecha", "Concepto", "Importe", "Proveedor"],
    ["01/10/2026", "Alquiler", "450000", "Inmobiliaria Sur"],
    ["03/10/2026", "Luz", "82000", "Edesur"],
    ["05/10/2026", "Internet", "25000", "Fibertel"],
  ] },
], [], { unrelated: true });

const clientHead = ["Nombre", "Teléfono", "Instagram", "Email", "DNI"];
save("import-clients", "c1_agenda", "ARS", [
  { name: "Agenda", rows: [
    clientHead,
    ["Ana Gómez", "11 5555-1234", "@ana.perez", "ana@gmail.com", "30111222"],
    ["Bruno Díaz", "+54 9 11 4444-2211", "https://instagram.com/bruno.diaz", "Bruno@Gmail.com", "28.444.555"],
    ["Carla Ruiz", "011 15 5555-9090", "instagram.com/@carla.ruiz/", "carla@tienda.com", "DNI 33444555"],
    ["Diego Paz", "261 444-5566", "@diego.paz", "diego@correo.com", "25999888"],
    ["Elena Soto", "+54 261 444-7788", "@elena.soto", "elena.soto@gmail.com", "27.111.333"],
  ] },
], [
  { name: "Ana Gómez", phone: "+5491155551234", instagram: "ana.perez", email: "ana@gmail.com", dni: "30111222" },
  { name: "Bruno Díaz", phone: "+5491144442211", instagram: "bruno.diaz", email: "bruno@gmail.com", dni: "28444555" },
  { name: "Carla Ruiz", phone: "+5491155559090", instagram: "carla.ruiz", email: "carla@tienda.com", dni: "33444555" },
  { name: "Diego Paz", phone: "+5492614445566", instagram: "diego.paz", email: "diego@correo.com", dni: "25999888" },
  { name: "Elena Soto", phone: "+5492614447788", instagram: "elena.soto", email: "elena.soto@gmail.com", dni: "27111333" },
]);

save("import-clients", "c2_encabezado_corrido", "ARS", [
  { name: "Clientes Palermo", rows: [
    ["MUNDO APPLE — CLIENTES"],
    ["Lista combinada, no borrar el título"],
    [],
    ["", "Nombre", "Teléfono", "Instagram", "Email", "DNI"],
    ["", "Fabián Luna", "11 6000-1010", "@fabian.luna", "fabian@luna.com", "20.111.222"],
    [],
    ["", "Gonzalo Pérez", "+5491160002020", "https://www.instagram.com/gonza.perez/?hl=es", "GONZA@PEREZ.COM", "31222333"],
    ["", ""],
  ] },
], [
  { name: "Fabián Luna", phone: "+5491160001010", instagram: "fabian.luna", email: "fabian@luna.com", dni: "20111222" },
  { name: "Gonzalo Pérez", phone: "+5491160002020", instagram: "gonza.perez", email: "gonza@perez.com", dni: "31222333" },
]);

save("import-clients", "c3_varias_tablas", "ARS", [
  { name: "Notas internas", rows: [
    ["Notas"],
    ["Recordar", "Detalle"],
    ["Feriado", "12 de octubre"],
  ] },
  { name: "Clientes", rows: [
    ["MINORISTAS"],
    clientHead,
    ["Helena Quiroga", "11 4321-0001", "@helena.q", "helena@mail.com", "30101010"],
    ["Iván Rojas", "11 4321-0002", "@ivan.rojas", "ivan@mail.com", "30101011"],
    [],
    ["MAYORISTAS"],
    clientHead,
    ["Julia Méndez", "+54 9 11 7000-3000", "@julia.mayor", "julia@mayor.com", "27.000.111"],
    ["Kevin Acosta", "011 15 7000-3001", "instagram.com/kevin.acosta", "kevin@mayor.com", "27000222"],
    ["TOTAL", "4 clientes", "", "", ""],
  ] },
], [
  { name: "Helena Quiroga", phone: "+5491143210001", instagram: "helena.q", email: "helena@mail.com", dni: "30101010" },
  { name: "Iván Rojas", phone: "+5491143210002", instagram: "ivan.rojas", email: "ivan@mail.com", dni: "30101011" },
  { name: "Julia Méndez", phone: "+5491170003000", instagram: "julia.mayor", email: "julia@mayor.com", dni: "27000111" },
  { name: "Kevin Acosta", phone: "+5491170003001", instagram: "kevin.acosta", email: "kevin@mayor.com", dni: "27000222" },
]);

save("import-clients", "c4_telefonos", "ARS", [
  { name: "WhatsApp", rows: [
    ["Nombre", "WhatsApp", "Instagram", "Email", "DNI"],
    ["Laura Benítez", "1155551234", "@laura.b", "laura@mail.com", "33400111"],
    ["Martín Correa", "+54 11 5555-1234", "@martin.c", "martin@mail.com", "33400112"],
    ["Nina Ferreyra", "011 15 5555-1234", "@nina.f", "nina@mail.com", "33400113"],
    ["Omar Vidal", "0261 15 444-5566", "@omar.v", "omar@mail.com", "33400114"],
    ["Paula Ibáñez", "+54 9 261 444-5566", "@paula.i", "paula@mail.com", "33400115"],
    ["Ramiro Costa", "5491144442211", "@ramiro.c", "ramiro@mail.com", "33400116"],
  ] },
], [
  { name: "Laura Benítez", phone: "+5491155551234", instagram: "laura.b", email: "laura@mail.com", dni: "33400111" },
  { name: "Martín Correa", phone: "+5491155551234", instagram: "martin.c", email: "martin@mail.com", dni: "33400112" },
  { name: "Nina Ferreyra", phone: "+5491155551234", instagram: "nina.f", email: "nina@mail.com", dni: "33400113" },
  { name: "Omar Vidal", phone: "+5492614445566", instagram: "omar.v", email: "omar@mail.com", dni: "33400114" },
  { name: "Paula Ibáñez", phone: "+5492614445566", instagram: "paula.i", email: "paula@mail.com", dni: "33400115" },
  { name: "Ramiro Costa", phone: "+5491144442211", instagram: "ramiro.c", email: "ramiro@mail.com", dni: "33400116" },
]);

save("import-clients", "c5_instagram_dni", "ARS", [
  { name: "Contactos", rows: [
    ["Cliente", "Celular", "IG", "Mail", "Documento"],
    ["Sara Molina", "11 2222-3344", "https://instagram.com/@sara.molina/", "Sara.Molina@Gmail.com", "30.555.666"],
    ["Tomás Alegre", "+54 9 11 2222-3345", "instagram.com/tomas.alegre", "TOMAS@alegre.com", "DNI 30.555.667"],
    ["Uma Brest", "0111555556677", "@uma.brest", "uma@brest.com", "30555668"],
  ] },
], [
  { name: "Sara Molina", phone: "+5491122223344", instagram: "sara.molina", email: "sara.molina@gmail.com", dni: "30555666" },
  { name: "Tomás Alegre", phone: "+5491122223345", instagram: "tomas.alegre", email: "tomas@alegre.com", dni: "30555667" },
  { name: "Uma Brest", phone: "+5491155556677", instagram: "uma.brest", email: "uma@brest.com", dni: "30555668" },
]);

save("import-clients", "c6_basura", "ARS", [
  { name: "Hoja1", rows: [
    ["LISTA VIEJA - IGNORAR EL PIE"],
    [],
    ["Nombre", "Teléfono", "WhatsApp", "Instagram", "Email", "DNI"],
    ["Vera Nieto", "011 4444-0000", "11 5555-8888", "@vera.nieto", "vera@nieto.com", "29.111.222"],
    ["", "sin nombre", "", "", "", ""],
    ["Wendy Salas", "", "+54 9 11 5555-9999", "@wendy.salas", "wendy@salas.com", "29111333"],
    ["TOTAL", "2", "", "", "", ""],
    ["nota", "pasar a la planilla nueva", "", "", "", ""],
  ] },
], [
  { name: "Vera Nieto", phone: "+5491155558888", instagram: "vera.nieto", email: "vera@nieto.com", dni: "29111222" },
  { name: "Wendy Salas", phone: "+5491155559999", instagram: "wendy.salas", email: "wendy@salas.com", dni: "29111333" },
]);

save("import-clients", "n_alumnos", "ARS", [
  { name: "Curso", rows: [
    ["Alumno", "Materia", "Nota"],
    ["Ana", "Matemática", "8"],
    ["Bruno", "Historia", "7"],
    ["Carla", "Física", "9"],
  ] },
], [], { unrelated: true });

console.log("fixtures ok");
