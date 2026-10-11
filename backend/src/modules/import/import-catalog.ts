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
      { key: "clientName", label: "Cliente", description: "Nombre de la persona que compró." },
      { key: "productImei", label: IMEI_LABEL, description: "IMEI del equipo vendido." },
      { key: "amount", label: "Total", description: "Importe total de la venta." },
      { key: "date", label: "Fecha", description: "Fecha de la venta." },
      { key: "paymentMethod", label: "Pago", description: "Forma de pago, por ejemplo efectivo, transferencia o tarjeta." },
      { key: "status", label: "Estado", description: "Estado de la venta." },
    ],
    hints: {
      cliente: "clientName",
      imei: "productImei",
      total: "amount",
      fecha: "date",
      pago: "paymentMethod",
      estado: "status",
    },
  },
  clients: {
    section: "clients",
    access: "clients",
    accessLabel: "Clientes",
    fields: [
      { key: "name", label: "Nombre", description: "Nombre del cliente." },
      { key: "dni", label: "DNI", description: "Documento del cliente." },
      { key: "phone", label: "Teléfono", description: "Teléfono de contacto." },
      { key: "email", label: "Email", description: "Correo electrónico." },
    ],
    hints: {
      nombre: "name",
      dni: "dni",
      telefono: "phone",
      email: "email",
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
