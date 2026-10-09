import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError, type ZodIssue } from "zod";

const GENERIC_INTERNAL_MESSAGE = "Ocurrió un error interno. Probá de nuevo.";

const FIELD_LABELS: Record<string, string> = {
  storeName: "nombre",
  name: "nombre",
  model: "modelo",
  cost: "costo",
  price: "precio",
  amount: "monto",
  imei: "IMEI",
  capacity: "capacidad",
  color: "color",
  condition: "condición",
  grade: "grado",
  batteryHealth: "batería",
  status: "estado",
  email: "email",
  phone: "teléfono",
  dni: "DNI",
  paymentMethod: "forma de pago",
  method: "forma de pago",
  clientName: "nombre",
  clientId: "cliente",
  deviceLabel: "equipo",
  deviceReceived: "equipo recibido",
  deviceReceivedImei: "IMEI",
  takeValue: "valor tomado",
  date: "fecha",
  categoryId: "categoría",
  saleCategoryId: "categoría",
  tag: "etiqueta",
  rows: "archivo",
  ids: "selección",
  itemIds: "selección",
  categoryIds: "categorías",
  sections: "secciones",
  role: "rol",
  taxId: "CUIT",
  address: "dirección",
  password: "contraseña",
  label: "nombre",
  value: "valor",
  startDate: "fecha de inicio",
  endDate: "fecha de fin",
  rangeKey: "período",
};

const FEMININE_LABELS = new Set([
  "capacidad",
  "condición",
  "batería",
  "forma de pago",
  "fecha",
  "categoría",
  "etiqueta",
  "selección",
  "dirección",
  "contraseña",
  "fecha de inicio",
  "fecha de fin",
]);

type FieldIssue = { field: string; message: string };

export type ApiValidationBody = {
  statusCode: 400;
  error: string;
  message: string;
  fields: Record<string, string>;
};

type FastifyValidationIssue = {
  instancePath?: string;
  dataPath?: string;
  keyword?: string;
  message?: string;
  params?: {
    limit?: number;
    missingProperty?: string;
    comparison?: string;
    type?: string;
  };
};

export function registerApiErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (reply.sent) return;

    const validation = toValidationBody(error, request.url);
    if (validation) {
      request.log.warn({ err: error }, "validation failed");
      return reply.code(400).send(validation);
    }

    const statusCode = statusCodeOf(error);
    if (statusCode >= 500) {
      request.log.error({ err: error }, "unhandled error");
      return reply.code(500).send({
        statusCode: 500,
        error: GENERIC_INTERNAL_MESSAGE,
        message: GENERIC_INTERNAL_MESSAGE,
      });
    }

    return reply.send(error);
  });
}

export function toValidationBody(error: unknown, url = ""): ApiValidationBody | null {
  const issues = collectIssues(unwrapError(error), url);
  if (!issues.length) return null;

  const fields: Record<string, string> = {};
  for (const issue of issues) {
    if (!fields[issue.field]) fields[issue.field] = issue.message;
  }

  const message = issues[0]?.message ?? "Revisá los datos enviados.";
  return {
    statusCode: 400,
    error: message,
    message,
    fields,
  };
}

function unwrapError(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("cause" in error)) return error;
  const cause = (error as { cause?: unknown }).cause;
  if (isZodError(cause) || isFastifyValidation(cause)) return cause;
  return error;
}

function collectIssues(error: unknown, url: string): FieldIssue[] {
  if (isZodError(error)) {
    return error.issues.map((issue) => zodIssue(issue, url));
  }

  if (isFastifyValidation(error)) {
    return error.validation.map((issue) => fastifyIssue(issue, url));
  }

  return [];
}

function isZodError(error: unknown): error is ZodError {
  if (error instanceof ZodError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; issues?: unknown };
  return candidate.name === "ZodError" && Array.isArray(candidate.issues);
}

function isFastifyValidation(error: unknown): error is { validation: FastifyValidationIssue[] } {
  return Boolean(error && typeof error === "object" && Array.isArray((error as { validation?: unknown }).validation));
}

function zodIssue(issue: ZodIssue, url: string): FieldIssue {
  const field = issue.path.length ? issue.path.map(String).join(".") : "body";
  return { field, message: zodMessage(issue, fieldLabel(field, url)) };
}

function zodMessage(issue: ZodIssue, label: string): string {
  if (isSpanishMessage(issue.message)) return issue.message;

  if (issue.code === "too_small" && issue.type === "string") {
    return Number(issue.minimum) <= 1
      ? phrase(label, "es obligatorio")
      : phrase(label, `tiene que tener al menos ${Number(issue.minimum)} caracteres`);
  }

  if (issue.code === "too_big" && issue.type === "string") {
    return phrase(label, `puede tener hasta ${Number(issue.maximum)} caracteres`);
  }

  if (issue.code === "too_small" && (issue.type === "number" || issue.type === "bigint")) {
    const minimum = Number(issue.minimum);
    if (minimum === 0) return phrase(label, "no puede ser negativo");
    const relation = issue.inclusive ? "mayor o igual a" : "mayor a";
    return phrase(label, `tiene que ser ${relation} ${minimum}`);
  }

  if (issue.code === "too_big" && (issue.type === "number" || issue.type === "bigint")) {
    return phrase(label, `no puede ser mayor a ${Number(issue.maximum)}`);
  }

  if (issue.code === "too_small" && (issue.type === "array" || issue.type === "set")) {
    const count = Number(issue.minimum);
    return phrase(label, `tiene que incluir al menos ${count} ${count === 1 ? "elemento" : "elementos"}`);
  }

  if (issue.code === "too_big" && (issue.type === "array" || issue.type === "set")) {
    return phrase(label, `puede tener hasta ${Number(issue.maximum)} elementos`);
  }

  if (issue.code === "invalid_type") {
    if (issue.received === "undefined" || issue.received === "null") return phrase(label, "es obligatorio");
    if (issue.expected === "number") return phrase(label, "tiene que ser un número");
    if (issue.expected === "string") return phrase(label, "tiene que ser texto");
    return phrase(label, "no es válido");
  }

  if (issue.code === "invalid_enum_value" || issue.code === "invalid_string" || issue.code === "invalid_literal") {
    return phrase(label, "no es válido");
  }

  return phrase(label, "no es válido");
}

function fastifyIssue(issue: FastifyValidationIssue, url: string): FieldIssue {
  const field = fastifyField(issue);
  const label = fieldLabel(field, url);
  const limit = typeof issue.params?.limit === "number" ? issue.params.limit : undefined;

  switch (issue.keyword) {
    case "required":
      return { field, message: phrase(label, "es obligatorio") };
    case "minLength":
      return {
        field,
        message: limit != null && limit > 1
          ? phrase(label, `tiene que tener al menos ${limit} caracteres`)
          : phrase(label, "es obligatorio"),
      };
    case "maxLength":
      return { field, message: phrase(label, `puede tener hasta ${limit ?? 0} caracteres`) };
    case "minimum":
    case "exclusiveMinimum":
      if (limit === 0) return { field, message: phrase(label, "no puede ser negativo") };
      return { field, message: phrase(label, `tiene que ser mayor${issue.keyword === "minimum" ? " o igual" : ""} a ${limit ?? 0}`) };
    case "maximum":
    case "exclusiveMaximum":
      return { field, message: phrase(label, `no puede ser mayor a ${limit ?? 0}`) };
    case "type":
      return {
        field,
        message: issue.params?.type === "number"
          ? phrase(label, "tiene que ser un número")
          : phrase(label, "no es válido"),
      };
    case "minItems":
      return { field, message: phrase(label, `tiene que incluir al menos ${limit ?? 1} elementos`) };
    case "maxItems":
      return { field, message: phrase(label, `puede tener hasta ${limit ?? 0} elementos`) };
    default:
      return { field, message: phrase(label, "no es válido") };
  }
}

function fastifyField(issue: FastifyValidationIssue): string {
  const raw = issue.instancePath || issue.dataPath || "";
  const path = raw.replace(/^\//, "").replace(/\//g, ".").replace(/^\./, "");
  if (path) return path;
  if (typeof issue.params?.missingProperty === "string" && issue.params.missingProperty) {
    return issue.params.missingProperty;
  }
  return "body";
}

function fieldLabel(field: string, url: string): string {
  const key = field.split(".").filter((part) => !/^\d+$/.test(part)).pop() ?? field;
  if (key === "amount" && /\/payments(?:\?|$)/.test(url)) return "pago";
  return FIELD_LABELS[key] ?? "dato";
}

function phrase(label: string, rest: string): string {
  const article = FEMININE_LABELS.has(label) ? "La" : "El";
  return `${article} ${label} ${rest}`;
}

function isSpanishMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return /[áéíóúñ¿¡]/i.test(text) || /^(El |La |Los |Las |No |Tenés |Revisá )/.test(text);
}

function statusCodeOf(error: unknown): number {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return 500;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" && statusCode >= 400 ? statusCode : 500;
}
