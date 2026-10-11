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
    if (question.type === "predicate") {
      const include = !/resumen|gr[aá]fico|proveedor/i.test(sheetName);
      return { name: question.name, type: "predicate", probability: include ? 0.96 : 0.04 };
    }
    if (question.name.endsWith("_hdr")) {
      const rows = (question.choices ?? []).map((choice) => Number(choice.value)).filter((row) => Number.isFinite(row));
      const picked = rows.length > 0 ? Math.min(...rows) : 1;
      return { name: question.name, type: "choice", choice: String(picked), confidence: 0.95 };
    }
    const header = /«([^»]*)»/.exec(question.instructions)?.[1] ?? "";
    return { name: question.name, type: "choice", choice: fieldForHeader(header), confidence: 0.9 };
  });
}

function fieldForHeader(header: string): string {
  const first = header.split(" / ")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "ignore";
  if (/precio normal|precio de lista/.test(first)) return "list_price";
  if (/promo/.test(first)) return "price";
  if (/precio|u\$d|u\$s|^usd$|\bdls\b/.test(first)) return "price";
  if (/pila|^bat\b|bater[ií]a|salud/.test(first)) return "batteryHealth";
  if (/tono|^color\b|colour/.test(first)) return "color";
  if (/^cond\b|estado|condici[oó]n/.test(first)) return "condition";
  if (/descrip|^equipo\b|^mod$|modelo/.test(first)) return "model";
  if (/imei|serie/.test(first)) return "imei";
  if (/capacidad|^alm$|^gb$|almacenamiento/.test(first)) return "capacity";
  if (/costo|^cost$/.test(first)) return "cost";
  return "ignore";
}
