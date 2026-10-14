import { parseImportNumber } from "../lib/import-number";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";
import { BrandLockup } from "../components/brand-mark";
import { ImportModal } from "../components/ImportModal";
import { useAppContext } from "../context/AppContext";
import {
  ExchangeProvider,
  exchangeFromStore,
  useMoney,
} from "../desk/exchange";
import { DeskOverlays } from "../desk/DeskOverlays";
import { CatalogProvider } from "../desk/catalog";
import { DeskProvider } from "../desk/ui";
import {
  analyzeImport,
  analyzeInventoryTextProgress,
  applyImportPlan,
  importBackendRows,
  type TextProgressRow,
} from "../services/import-api";
import { createSampleStock } from "../services/getting-started-api";
import {
  onboardingPayload,
  onboardingTotals,
  prepareOnboardingRows,
} from "../lib/onboarding-stock";
import { textRowError } from "../lib/text-import-review";
import { toUserMessage } from "../lib/user-message";
import "./onboarding.css";

type Step = "choose" | "paste" | "analyzing" | "partial" | "invalid" | "review";
const EXAMPLE =
  "13 pro max 256 azul bat 85 520usd\niPhone 14 128 midnight 89% US$ 590\n15 pro 256 natural 92% 980usd";
const fmt = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

export function StockOnboarding({
  onFinish,
}: {
  onFinish: (destination: "inventory" | "dashboard") => void;
}) {
  const { appSession } = useAppContext();
  return (
    <ExchangeProvider settings={exchangeFromStore(appSession?.store)}>
      <StockFlow onFinish={onFinish} />
    </ExchangeProvider>
  );
}
function StockFlow({
  onFinish,
}: {
  onFinish: (destination: "inventory" | "dashboard") => void;
}) {
  const {
    user,
    appSession,
    reloadInventory,
    reloadSession,
    updateGettingStarted,
    refreshGettingStarted,
    inventory,
  } = useAppContext();
  const money = useMoney();
  const [step, setStep] = useState<Step>("choose");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [discarded, setDiscarded] = useState<
    { line: number; original: string; reason: string }[]
  >([]);
  const [partialRows, setPartialRows] = useState<TextProgressRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [alternative, setAlternative] = useState<"excel" | "manual" | null>(
    null,
  );
  const [editing, setEditing] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const editorDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = editorDialog.current;
    if (editing !== null) dialog?.showModal();
    return () => dialog?.close();
  }, [editing]);
  useEffect(() => () => controller.current?.abort(), []);
  const totals = onboardingTotals(rows, money.rate);
  const validation = rows.map(textRowError).find(Boolean);
  const finish = async (destination: "inventory" | "dashboard") => {
    if (
      appSession?.membership?.role === "OWNER" &&
      appSession.store?.onboardingStartedAt &&
      !appSession.store.onboardingCompletedAt
    ) {
      await updateGettingStarted({ complete: true });
    } else {
      await refreshGettingStarted();
    }
    window.history.replaceState(
      null,
      "",
      destination === "inventory" ? "#/inv" : "#/dash",
    );
    // Refresh before leaving: a failed persistence never closes the flow as success.
    await reloadInventory();
    await reloadSession();
    onFinish(destination);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(toUserMessage(cause, "No se pudo guardar. Volvé a intentarlo."));
    } finally {
      setBusy(false);
    }
  };
  const analyze = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    setPartialRows([]);
    setStep("analyzing");
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    try {
      const result = await analyzeInventoryTextProgress(
        user,
        text,
        (next) => setPartialRows((current) => [...current, ...next]),
        active.signal,
      );
      if (active.signal.aborted) return;
      setRows(prepareOnboardingRows(result));
      setDiscarded(result.discarded ?? []);
      setStep(
        result.rows.length === 0
          ? "invalid"
          : result.discarded?.length
            ? "partial"
            : "review",
      );
    } catch (cause) {
      if (!active.signal.aborted) {
        setError(toUserMessage(cause));
        setStep("paste");
      }
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  };
  const save = async () => {
    if (!user) return;
    const payload = onboardingPayload(rows);
    const result = await importBackendRows(user, "inventory", payload);
    if (result.errors.length) {
      // The existing importer may persist a subset. Retrying must send only failures.
      const expanded = rows.flatMap((row) =>
        Array.from({ length: Number(row.quantity) }, () => ({
          ...row,
          quantity: "1",
        })),
      );
      setRows(
        result.errors.map((item) => ({
          ...expanded[item.row - 1],
          _review: item.message,
        })),
      );
      await reloadInventory();
      throw new Error(
        `Guardamos ${result.imported + result.updated} equipos. Quedan ${result.errors.length} para corregir: ${result.errors.map((item) => item.message).join(" · ")}`,
      );
    }
    setRows([]);
    await finish("inventory");
  };
  const change = (field: string, value: string) =>
    setRows((current) =>
      current.map((row, index) =>
        index === editing ? { ...row, [field]: value } : row,
      ),
    );
  const toAlternative = (value: "excel" | "manual") => {
    setError("");
    setAlternative(value);
  };
  const review = step === "review";
  return (
    <div
      className="onb stock-onb"
      data-testid="stock-onboarding"
      aria-busy={busy}
    >
      <header className="onb-header">
        <BrandLockup variant="horizontal" className="onb-logo" />
        {step !== "choose" && (
          <button
            className="onb-link"
            disabled={busy}
            onClick={() => {
              setStep("choose");
              setError("");
            }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
        )}
      </header>
      <main className={`onb-main${review ? " onb-wide" : ""}`}>
        <div className="onb-steps" aria-label="Paso 4 de 4">
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
        </div>
        {error && (
          <p className="onb-error" role="alert">
            {error}
          </p>
        )}
        {step === "choose" && (
          <>
            <h1>Cargá tu stock</h1>
            <p>Con tus equipos cargados ya ves cuánto vale tu stock.</p>
            <section className="onb-paste-card">
              <span className="onb-badge">
                <Sparkles size={13} /> Lo más rápido
              </span>
              <h2>Pegá tu lista de equipos</h2>
              <p>
                La misma que mandás por WhatsApp. La leemos y armamos el
                inventario; vos revisás antes de guardar.
              </p>
              <pre>{EXAMPLE}</pre>
              <button className="onb-yellow" onClick={() => setStep("paste")}>
                <ClipboardList size={18} /> Pegar mi lista
              </button>
            </section>
            <div className="onb-alternatives">
              <button onClick={() => toAlternative("excel")}>
                <FileSpreadsheet />
                Subir Excel
              </button>
              <button onClick={() => toAlternative("manual")}>
                <Plus />
                Cargar a mano
              </button>
              <button onClick={() => file.current?.click()}>
                <FileText />
                Subir .txt
              </button>
            </div>
            {appSession?.membership?.role === "OWNER" &&
              appSession.store?.onboardingStartedAt &&
              !appSession.store.onboardingCompletedAt && (
                <button
                  className="onb-sample"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (!user) return;
                      await createSampleStock(user);
                      await reloadInventory();
                      await refreshGettingStarted();
                      window.history.replaceState(null, "", "#/dash");
                      await reloadSession();
                      onFinish("dashboard");
                    })
                  }
                >
                  <Sparkles size={18} />
                  <span>
                    <b>Probar con datos de ejemplo</b>
                    <small>
                      Mirá la app llena sin cargar nada. Los borrás con un
                      toque.
                    </small>
                  </span>
                  ›
                </button>
              )}
            {inventory.length > 0 && (
              <button
                className="onb-primary"
                disabled={busy}
                onClick={() => void run(() => finish("inventory"))}
              >
                Ir a mi inventario
              </button>
            )}
            <button
              className="onb-link onb-skip"
              disabled={busy}
              onClick={() => void run(() => finish("dashboard"))}
            >
              Saltar por ahora
            </button>
          </>
        )}
        {["paste", "partial", "invalid"].includes(step) && (
          <>
            <h1>Pegá tu lista</h1>
            {step === "paste" && (
              <p>
                Copiala de WhatsApp o de tus notas, como la tenés. Un equipo por
                línea.
              </p>
            )}
            {step === "partial" && (
              <div className="onb-alert" role="status">
                <b>
                  Reconocimos{" "}
                  {text.split("\n").filter((line) => line.trim()).length -
                    discarded.length}{" "}
                  de {text.split("\n").filter((line) => line.trim()).length}{" "}
                  líneas
                </b>
                <p>
                  Las {discarded.length} sin reconocer no parecen equipos.
                  Editalas o borralas y volvé a analizar, o seguí sin ellas.
                </p>
              </div>
            )}
            {step === "invalid" && (
              <div className="onb-error">
                <b>Este texto no parece tener equipos para importar</b>
                <p>
                  Probá pegar la lista con un equipo por línea, por ejemplo:
                  «iPhone 13 128GB azul 89% US$ 420».
                </p>
              </div>
            )}
            <label htmlFor="onb-text" className="sr-only">
              Listado de equipos
            </label>
            <textarea
              id="onb-text"
              className="onb-text"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              maxLength={100000}
            />
            {discarded.length > 0 && (
              <details className="onb-discarded" open>
                <summary>Líneas sin reconocer</summary>
                {discarded.map((item) => (
                  <label key={item.line}>
                    Línea {item.line}: {item.reason}
                    <input
                      aria-label={`Línea ${item.line} sin reconocer`}
                      value={text.split("\n")[item.line - 1] ?? ""}
                      onChange={(e) => {
                        const lines = text.split("\n");
                        lines[item.line - 1] = e.target.value;
                        setText(lines.join("\n"));
                      }}
                    />
                  </label>
                ))}
              </details>
            )}
            {step === "invalid" && (
              <div className="onb-alternatives">
                <button onClick={() => toAlternative("excel")}>
                  <FileSpreadsheet />
                  Subir Excel
                </button>
                <button onClick={() => toAlternative("manual")}>
                  <Plus />
                  Cargar a mano
                </button>
              </div>
            )}
            <div className="onb-dock">
              <button
                className="onb-primary"
                disabled={busy || !text.trim()}
                onClick={() => void analyze()}
              >
                <Sparkles size={18} />
                {step === "paste" ? "Analizar mi lista" : "Volver a analizar"}
              </button>
              {step === "partial" && (
                <button className="onb-link" onClick={() => setStep("review")}>
                  Seguir con las reconocidas
                </button>
              )}
            </div>
            <small className="onb-note">
              No guardamos nada hasta que revises y confirmes.
            </small>
          </>
        )}
        {step === "analyzing" && (
          <section aria-live="polite">
            <span className="onb-loading">
              <Sparkles size={32} />
            </span>
            <h1>Estamos leyendo tu lista</h1>
            <p>
              Reconocemos los equipos y sus precios. Vos revisás antes de
              guardar.
            </p>
            <div className="onb-progress-indeterminate" />
            <b>
              {partialRows.reduce((sum, row) => sum + row.quantity, 0)} equipos
              reconocidos
            </b>
            <ul className="onb-partials">
              {partialRows.map((row, index) => (
                <li key={index}>
                  <Check size={16} />
                  {row.model}
                  {row.quantity > 1 && ` ×${row.quantity}`}
                </li>
              ))}
            </ul>
            <small>No guardamos nada hasta tu revisión.</small>
            <button
              className="onb-link"
              onClick={() => {
                controller.current?.abort();
                setBusy(false);
                setStep("paste");
              }}
            >
              Cancelar análisis
            </button>
          </section>
        )}
        {review && (
          <>
            <div className="onb-confetti" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    left: `${index * 5.7}%`,
                    animationDelay: `${(index % 4) * 0.08}s`,
                    background: ["#FFD000", "#24A76D", "#16181D"][index % 3],
                  }}
                />
              ))}
            </div>
            <h1 className="onb-success">
              <span>
                <Check />
              </span>
              ¡Listo, {appSession?.store?.name}!
            </h1>
            <p>Armamos {totals.count} equipos. Revisá los marcados y guardá.</p>
            <div className="onb-result-layout">
              <div>
                <section className="onb-value">
                  <h2>Valor de tu stock</h2>
                  <strong data-testid="onboarding-stock-usd">
                    US$ {fmt(totals.usd)}
                  </strong>
                  <p>
                    ≈ $ {fmt(totals.ars)}{" "}
                    {appSession?.store?.exchangeMode === "manual"
                      ? "al dólar manual"
                      : `al ${appSession?.store?.exchangeSource ?? "blue"}`}
                  </p>
                  {money.rate === null && (
                    <small>
                      La conversión necesita una cotización disponible. No
                      bloquea el guardado.
                    </small>
                  )}
                </section>
                <div className="onb-stats">
                  <div>
                    Equipos
                    <strong data-testid="onboarding-equipment-count">
                      {totals.count}
                    </strong>
                  </div>
                  <div>
                    Para revisar<strong>{totals.review}</strong>
                  </div>
                </div>
                <small>
                  Los equipos «Para revisar» se guardan con la marca. Los datos
                  que faltan quedan pendientes, sin inventar precios.
                </small>
              </div>
              <section>
                <div className="onb-review-heading">
                  REVISIÓN RÁPIDA <span>{totals.review} CON DUDAS</span>
                </div>
                <div className="onb-review-list">
                  {rows.map((row, index) => (
                    <div key={index} className={row._review ? "doubt" : ""}>
                      <div>
                        <b>
                          {row.model} · {row.capacity || "¿capacidad?"}
                        </b>
                        <small>
                          {row.color || "Sin color"} ·{" "}
                          {row.batteryHealth || "Sin batería"}
                          {Number(row.quantity) > 1
                            ? ` · ×${row.quantity}`
                            : ""}
                        </small>
                        {row._review && (
                          <small className="onb-doubt">⚠ {row._review}</small>
                        )}
                      </div>
                      <button
                        aria-label={`Revisar ${row.model}, fila ${index + 1}`}
                        onClick={() => setEditing(index)}
                      >
                        {row._review
                          ? "Revisar"
                          : `${row.currency === "USD" ? "US$" : "$"} ${fmt(parseImportNumber(row.price) ?? 0)}`}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            {validation && (
              <p className="onb-error">
                {validation} Abrí Revisar para corregirlo.
              </p>
            )}
            <div className="onb-dock">
              <button
                className="onb-primary"
                disabled={busy || rows.length === 0 || Boolean(validation)}
                onClick={() => void run(save)}
              >
                {busy
                  ? "Guardando…"
                  : `Guardar ${totals.count} equipos e ir al inventario`}
              </button>
            </div>
          </>
        )}
      </main>
      <input
        ref={file}
        type="file"
        accept=".txt,text/plain"
        hidden
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (!selected) return;
          void run(async () => {
            if (selected.size > 100000)
              throw new Error("El texto supera los 100 KB.");
            const value = new TextDecoder("utf-8", { fatal: true }).decode(
              await selected.arrayBuffer(),
            );
            setText(value);
            setStep("paste");
          });
          event.target.value = "";
        }}
      />
      {alternative === "excel" && user && (
        <ImportModal
          title="Importar equipos"
          fields={[
            { key: "model", label: "Modelo", required: true },
            { key: "price", label: "Precio", required: false },
            { key: "imei", label: "IMEI", required: false },
            { key: "capacity", label: "Capacidad", required: false },
            { key: "color", label: "Color", required: false },
            { key: "batteryHealth", label: "Batería", required: false },
            { key: "condition", label: "Condición", required: false },
            { key: "cost", label: "Costo", required: false },
          ]}
          onClose={() => setAlternative(null)}
          onAnalyze={(sheets) => analyzeImport(user, "inventory", sheets)}
          onApply={(sheets, plan, refresh) =>
            applyImportPlan(user, "inventory", sheets, plan, refresh)
          }
          onImport={async (imported) => {
            const result = await importBackendRows(
              user,
              "inventory",
              imported.map((row) => ({
                ...row,
                imei: row.imei ?? "",
                model: row.model,
                price: parseImportNumber(row.price) ?? 0,
                cost: parseImportNumber(row.cost),
              })),
            );
            await reloadInventory();
            if (!result.errors.length) await finish("inventory");
            return result;
          }}
        />
      )}
      {alternative === "manual" && (
        <div className="desk-app onb-desk-overlays">
          <CatalogProvider>
            <DeskProvider
              value={{
                tab: "inventory",
                openRecord: () => undefined,
                go: () => setAlternative(null),
                open: () => undefined,
                close: () => setAlternative(null),
                toast: () => undefined,
                isStaff: false,
              }}
            >
              <DeskOverlays overlay={{ type: "new-eq" }} />
            </DeskProvider>
          </CatalogProvider>
        </div>
      )}
      {editing !== null && rows[editing] && (
        <dialog
          ref={editorDialog}
          className="onb-edit-backdrop"
          aria-label="Revisar equipo"
          onCancel={() => setEditing(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <section className="onb-editor">
            <h2>Revisar equipo</h2>
            <p>{rows[editing]._review}</p>
            {(
              [
                "model",
                "capacity",
                "color",
                "batteryHealth",
                "price",
                "quantity",
                "imei",
              ] as const
            ).map((field, index) => (
              <label key={field}>
                {
                  [
                    "Modelo",
                    "Capacidad",
                    "Color",
                    "Batería",
                    "Precio",
                    "Cantidad",
                    "IMEI",
                  ][index]
                }
                <input
                  value={rows[editing][field] ?? ""}
                  onChange={(e) => change(field, e.target.value)}
                />
              </label>
            ))}
            <label>
              Moneda
              <select
                value={rows[editing].currency}
                onChange={(e) => change("currency", e.target.value)}
              >
                <option>USD</option>
                <option>ARS</option>
              </select>
            </label>
            <label>
              Condición
              <select
                value={rows[editing].condition}
                onChange={(e) => change("condition", e.target.value)}
              >
                <option>USADO</option>
                <option>NUEVO</option>
                <option>PRE-OWNED</option>
                <option>OUTLET</option>
              </select>
            </label>
            {textRowError(rows[editing]) && (
              <p role="alert">{textRowError(rows[editing])}</p>
            )}
            <button className="onb-primary" onClick={() => setEditing(null)}>
              Listo
            </button>
            <button
              className="onb-link"
              disabled={Boolean(textRowError(rows[editing]))}
              onClick={() => {
                change("_review", "");
                setEditing(null);
              }}
            >
              Marcar como revisado
            </button>
          </section>
        </dialog>
      )}
    </div>
  );
}
