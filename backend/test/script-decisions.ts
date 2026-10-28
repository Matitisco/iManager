type DecisionQuestion = {
  name: string;
  type: string;
  instructions: string;
  choices?: { value: string }[];
};

type DecisionBody = {
  input: string;
  questions: DecisionQuestion[];
};

// Stand-in for gpt-6-luna used by the offline fixture tests. It reads the same
// question names the production request builds and never calls the network.
export function scriptDecisionAnswers(body: DecisionBody): {
  name: string;
  type: string;
  probability?: number;
  choice?: string;
  confidence?: number;
}[] {
  return body.questions.map((question) => {
    const sheet = Number(/^h(\d+)_/.exec(question.name)?.[1] ?? 0);
    const sheetName = new RegExp(`\\[H${sheet}\\] Hoja «([^»]*)»`).exec(body.input)?.[1] ?? "";
    const hint = /Pista falible H/.test(body.input) ? JSON.parse(new RegExp(`Pista falible H${sheet}: ([^\\n]+)`).exec(body.input)?.[1] ?? "null") : null;
    if (question.type === "predicate") {
      const include = !/resumen|gr[aá]fico|proveedor|gastos|alumnos/i.test(sheetName);
      return { name: question.name, type: "predicate", probability: include ? 0.96 : 0.04 };
    }
    if (question.name.endsWith("_hdr")) {
      const rows = (question.choices ?? []).map((choice) => Number(choice.value)).filter((row) => Number.isFinite(row));
      const picked = hint?.headerRow ?? (rows.length > 0 ? Math.min(...rows) : 1);
      return { name: question.name, type: "choice", choice: String(picked), confidence: 0.95 };
    }
    const header = /«([^»]*)»/.exec(question.instructions)?.[1] ?? "";
    const guessed = fieldForHeader(header, question.choices ?? []);
    const column = Number(/_c(\d+)/.exec(question.name)?.[1]);
    const hinted = hint?.mapping.find((item: { columnIndex: number }) => item.columnIndex === column)?.field;
    const choice = hint ? (/^(?:usado|nuevo|sellado)$/i.test(header) ? "condition" : hinted || guessed) : guessed;
    return { name: question.name, type: "choice", choice, confidence: 0.9 };
  });
}

function fieldForHeader(header: string, choices: { value: string }[]): string {
  const allowed = new Set(choices.map((choice) => choice.value));
  const first = header.split(" / ")[0]?.trim().toLowerCase() ?? "";
  const guessed = guessField(first);
  if (allowed.has(guessed)) return guessed;
  const aliases: Record<string, string[]> = {
    price: ["amount"],
    model: ["device"],
    imei: ["productImei"],
    condition: ["status"],
    name: ["clientName"],
    clientName: ["name"],
  };
  for (const alias of aliases[guessed] ?? []) {
    if (allowed.has(alias)) return alias;
  }
  return allowed.has("ignore") ? "ignore" : "ignore";
}

function guessField(first: string): string {
  if (!first) return "ignore";
  if (/precio normal|precio de lista/.test(first)) return "list_price";
  if (/promo/.test(first)) return "price";
  if (/precio|importe|monto|u\$d|u\$s|^usd$|\bdls\b/.test(first)) return "price";
  if (/pila|^bat\b|bater[ií]a|salud/.test(first)) return "batteryHealth";
  if (/tono|^color\b|colour/.test(first)) return "color";
  if (/^cond\b|estado|condici[oó]n/.test(first)) return "condition";
  if (/fecha|^d[ií]a\b/.test(first)) return "date";
  if (/comprador/.test(first)) return "clientName";
  if (/^cliente\b/.test(first)) return "clientName";
  if (/vendedor|^vend\b/.test(first)) return "seller";
  if (/canje|permuta/.test(first)) return "tradeIn";
  if (/medio de pago|^pago\b|^medio\b/.test(first)) return "paymentMethod";
  if (/moneda/.test(first)) return "currency";
  if (/whatsapp|wsp|celular|tel[eé]fono/.test(first)) return "phone";
  if (/instagram|^ig\b/.test(first)) return "instagram";
  if (/^mail\b|e-?mail|correo/.test(first)) return "email";
  if (/^dni\b|documento/.test(first)) return "dni";
  if (/^nombre\b/.test(first)) return "name";
  if (/descrip|^equipo\b|^mod$|modelo/.test(first)) return "model";
  if (/imei|serie/.test(first)) return "imei";
  if (/capacidad|^alm$|^gb$|almacenamiento/.test(first)) return "capacity";
  if (/costo|^cost$/.test(first)) return "cost";
  return "ignore";
}
