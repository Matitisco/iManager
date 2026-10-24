import type { SectionId } from "../stores/sections.js";

export const IMPORT_SECTIONS = ["inventory", "sales", "clients", "trade-ins"] as const;

export type ImportSection = (typeof IMPORT_SECTIONS)[number];

export type ImportField = {
  key: string;
  label: string;
  description: string;
};

export type ImportCatalog = {
  section: ImportSection;
  access: SectionId;
  accessLabel: string;
  fields: ImportField[];
  hints: Record<string, string>;
};

const IMEI_LABEL = "IMEI (opcional)";

export const IMPORT_CATALOGS: Record<ImportSection, ImportCatalog> = {
  inventory: {
    section: "inventory",
    access: "inventory",
    accessLabel: "Inventario",
    fields: [
      { key: "model", label: "Modelo", description: "Nombre comercial del equipo, por ejemplo iPhone 13 o Galaxy S21." },
      { key: "imei", label: IMEI_LABEL, description: "Identificador único del equipo, en general 15 dígitos." },
      { key: "price", label: "Precio", description: "Precio de venta." },
      { key: "currency", label: "Moneda", description: "Moneda del equipo, ARS o USD. No convierte el importe." },
      { key: "capacity", label: "Capacidad", description: "Almacenamiento, por ejemplo 128 GB o 256 GB." },
      { key: "color", label: "Color", description: "Color del equipo." },
      { key: "condition", label: "Condición", description: "Si el equipo es nuevo o usado." },
      { key: "grade", label: "Calidad", description: "Calidad cosmética A+, A, B o C. Solo aplica a usados." },
      { key: "batteryHealth", label: "Batería", description: "Salud de la batería, por ejemplo 87% o 83-85%." },
      { key: "cost", label: "Costo", description: "Costo de compra del equipo." },
      { key: "status", label: "Estado", description: "Estado de stock, por ejemplo disponible, reservado o vendido." },
    ],
    hints: {
      modelo: "model",
      equipo: "model",
      imei: "imei",
      serial: "imei",
      precio: "price",
      moneda: "currency",
      capacidad: "capacity",
      gb: "capacity",
      almacenamiento: "capacity",
      color: "color",
      colour: "color",
      colores: "color",
      pintura: "color",
      condicion: "condition",
      grado: "grade",
      calidad: "grade",
      bateria: "batteryHealth",
      costo: "cost",
      estado: "status",
    },
  },
  sales: {
    section: "sales",
    access: "sales",
    accessLabel: "Ventas",
    fields: [
      { key: "date", label: "Fecha", description: "Fecha de la venta, en cualquier formato habitual (12/10/2026, 2026-10-12, 12 oct 2026)." },
      { key: "clientName", label: "Cliente", description: "Nombre de la persona que compró." },
      { key: "clientDni", label: "DNI del cliente", description: "Documento del cliente, si la planilla lo trae, para vincular sin duplicar." },
      { key: "clientPhone", label: "Teléfono del cliente", description: "Teléfono o WhatsApp del cliente, si la planilla lo trae." },
      { key: "device", label: "Equipo", description: "Modelo del equipo vendido, por ejemplo iPhone 13 128 GB." },
      { key: "productImei", label: IMEI_LABEL, description: "IMEI del equipo vendido. Sirve para vincular el stock existente." },
      { key: "amount", label: "Precio", description: "Importe de la venta, en la moneda de la celda o de la columna." },
      { key: "currency", label: "Moneda", description: "ARS o USD. No convierte el importe." },
      { key: "paymentMethod", label: "Pago", description: "Medio de pago: efectivo, transferencia, tarjeta o canje." },
      { key: "tradeIn", label: "Canje", description: "Equipo entregado en canje, si la venta lo menciona." },
      { key: "seller", label: "Vendedor", description: "Quién cerró la venta en la tienda." },
      { key: "status", label: "Estado", description: "Estado de la venta." },
    ],
    hints: {
      fecha: "date",
      dia: "date",
      cliente: "clientName",
      comprador: "clientName",
      nombre: "clientName",
      dni: "clientDni",
      documento: "clientDni",
      telefono: "clientPhone",
      whatsapp: "clientPhone",
      celular: "clientPhone",
      equipo: "device",
      modelo: "device",
      descripcion: "device",
      imei: "productImei",
      serie: "productImei",
      total: "amount",
      precio: "amount",
      importe: "amount",
      monto: "amount",
      moneda: "currency",
      pago: "paymentMethod",
      medio: "paymentMethod",
      canje: "tradeIn",
      permuta: "tradeIn",
      vendedor: "seller",
      vend: "seller",
      estado: "status",
    },
  },
  clients: {
    section: "clients",
    access: "clients",
    accessLabel: "Clientes",
    fields: [
      { key: "name", label: "Nombre", description: "Nombre del cliente." },
      { key: "phone", label: "Teléfono", description: "Teléfono o WhatsApp. Se guarda como +549 y el número nacional." },
      { key: "instagram", label: "Instagram", description: "Usuario de Instagram, con o sin @ o como link del perfil." },
      { key: "email", label: "Email", description: "Correo electrónico." },
      { key: "dni", label: "DNI", description: "Documento del cliente, con o sin puntos." },
    ],
    hints: {
      nombre: "name",
      cliente: "name",
      telefono: "phone",
      whatsapp: "phone",
      celular: "phone",
      celu: "phone",
      wsp: "phone",
      instagram: "instagram",
      ig: "instagram",
      email: "email",
      mail: "email",
      correo: "email",
      dni: "dni",
      documento: "dni",
    },
  },
  "trade-ins": {
    section: "trade-ins",
    access: "tradeins",
    accessLabel: "Canjes",
    fields: [
      { key: "clientName", label: "Cliente", description: "Nombre de la persona que entrega el equipo." },
      { key: "deviceReceived", label: "Equipo recibido", description: "Equipo que ingresa a la tienda en el canje." },
      { key: "deviceReceivedImei", label: IMEI_LABEL, description: "IMEI del equipo recibido." },
      { key: "takeValue", label: "Valor tomado", description: "Valor que se le reconoce al equipo recibido." },
      { key: "deviceGiven", label: "Equipo entregado", description: "Equipo que la tienda entrega en el canje." },
      { key: "differencePaid", label: "Diferencia", description: "Diferencia de plata del canje." },
      { key: "status", label: "Estado", description: "Estado del canje." },
    ],
    hints: {
      cliente: "clientName",
      recibido: "deviceReceived",
      imei: "deviceReceivedImei",
      valor: "takeValue",
      entrega: "deviceGiven",
      diferencia: "differencePaid",
      estado: "status",
    },
  },
};
