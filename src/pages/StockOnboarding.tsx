import { ReplayValue } from '../desk/replay-privacy';
import { capture } from '../lib/posthog-analytics';
import { track, rowBucket } from '../lib/analytics';
import { parseImportNumber } from "../lib/import-number";
import { inventoryImportPayload } from '../lib/inventory-import-payload';
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
  esCount,
  onboardingPayload,
  onboardingTotals,
  prepareOnboardingRows,
  readingLinesLabel,
  recognizedLinesHeading,
  recognizedSlices,
  unrecognizedNote,
  withoutCurrencyNote,
  type RecognizedEquipment,
} from "../lib/onboarding-stock";
import { textRowError } from "../lib/text-import-review";
import { toActionMessage } from "../lib/user-message";
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
    finishStockOnboarding,
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
  const [lineCount, setLineCount] = useState(0);
  const [analyzeStep, setAnalyzeStep] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [alternative, setAlternative] = useState<"excel" | "manual" | null>(
    null,
  );
  const [editing, setEditing] = useState<number | null>(null);
  const importSaved = useRef(false);
  const importStage = useRef<'file' | 'mapping' | 'review' | 'analyze'>('file');
  useEffect(() => { if (step === 'choose') track('onboarding_stock_viewed'); }, [step]);
  const importFinished = (method: 'excel' | 'paste' | 'manual', count: number, errors: number) => {
    if (method !== 'paste' && count > 0) importSaved.current = true;
    track('stock_import_finished', { method, ok: errors === 0, rows: rowBucket(count), errors });
  };
  const closeAlternative = () => {
    if (alternative && !importSaved.current) track('stock_import_abandoned', { method: alternative, ...(alternative === 'excel' ? { at: importStage.current } : {}) });
    setAlternative(null);
  };
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
  const finish = async (destination: "inventory" | "dashboard", completedVia: "import" | "skip" | "sample" = "import") => {
    window.history.replaceState(
      null,
      "",
      destination === "inventory" ? "#/inv" : "#/dash",
    );
    // Store membership already exists. Optional progress and read refreshes
    // must not trap an owner after skipping or successfully saving stock.
    if (appSession?.membership?.role === "OWNER" && appSession.store?.onboardingStartedAt) {
      finishStockOnboarding(completedVia);
    }
    void reloadInventory().catch(() => console.warn('No se pudo actualizar el inventario al salir de stock.'));
    void refreshGettingStarted();
    capture(completedVia === 'skip' ? 'onboarding_step_skipped' : 'onboarding_step_completed', { step: 'stock' });
    onFinish(destination);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(toActionMessage(cause, "No se pudo guardar. Volvé a intentarlo."));
    } finally {
      setBusy(false);
    }
  };
  const pause = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  const reveal = async (slices: RecognizedEquipment[][], signal: AbortSignal) => {
    for (let index = 0; index < slices.length; index += 1) {
      if (signal.aborted) return;
      const slice = slices[index];
      setPartialRows((current) => [...current, ...slice]);
      setAnalyzeStep({ done: index + 1, total: slices.length });
      await pause(50, signal);
    }
  };
  const analyze = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    setPartialRows([]);
    setAnalyzeStep(null);
    const lines = text.split("\n").filter((line) => line.trim()).length;
    setLineCount(lines);
    setStep("analyzing");
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    let revealed = 0;
    try {
      const result = await analyzeInventoryTextProgress(
        user,
        text,
        async (next) => {
          if (!next.length || active.signal.aborted) return;
          revealed += next.reduce((sum, row) => sum + row.quantity, 0);
          await reveal(
            recognizedSlices(next, Math.max(next.length, 1), 1),
            active.signal,
          );
        },
        active.signal,
      );
      if (active.signal.aborted) return;
      if (revealed === 0 && result.rows.length) {
        await reveal(
          recognizedSlices(
            result.rows.map((row, index) => ({
              model: row.model,
              quantity: row.quantity,
              line: result.review?.[index]?.line,
            })),
            lines,
          ),
          active.signal,
        );
      }
      if (active.signal.aborted) return;
      if (result.rows.length) await pause(400, active.signal);
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
        setError(toActionMessage(cause));
        setStep("paste");
      }
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  };
  const save = async () => {
    if (!user) return;
    const payload = onboardingPayload(rows);
    let result: Awaited<ReturnType<typeof importBackendRows>>;
    try { result = await importBackendRows(user, "inventory", payload, undefined, "text"); }
    catch (cause) { importFinished('paste', payload.length, 1); throw cause; }
    importFinished('paste', result.imported + result.updated, result.errors.length);
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
      const saved = result.imported + result.updated;
      const pending = result.errors.length;
      throw new Error(
        `Guardamos ${esCount(saved, "equipo", "equipos")}. ${pending === 1 ? "Queda 1 para corregir" : `Quedan ${pending} para corregir`}: ${result.errors.map((item) => toActionMessage(item.message)).join(" · ")}`,
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
    track('stock_method_chosen', { method: value });
    importSaved.current = false;
    importStage.current = 'file';
    setError("");
    setAlternative(value);
  };
  const review = step === "review";
  return (
    <div
      className={`onb stock-onb${step === "choose" ? " onb-setup" : ""}`}
      data-testid="stock-onboarding"
      aria-busy={busy}
    >
      <header className="onb-header">
        <BrandLockup variant="horizontal" className="onb-logo" />
        <span className="onb-step-label">Paso 2 de 2</span>
        {step !== "choose" && (
          <button
            className="onb-link"
            disabled={busy}
            onClick={() => {
              track('stock_import_abandoned', { method: 'paste', at: step === 'paste' || step === 'invalid' ? 'file' : 'review' });
              setStep("choose");
              setError("");
            }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
        )}
      </header>
      <main className={`onb-main${review ? " onb-wide" : ""}`}>
        <div className="onb-steps" aria-label="Paso 2 de 2">
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
            <p>Y ves cuánto vale tu stock.</p>
            <section className="onb-paste-card onb-excel-card">
              <h2>Subí tu Excel</h2>
              <p>Lo leemos y vos revisás antes de guardar.</p>
              <button className="onb-yellow" disabled={busy} onClick={() => toAlternative("excel")}>
                <FileSpreadsheet size={18} /> Subir Excel
              </button>
            </section>
            <div className="onb-alternatives onb-stock-options">
              <button disabled={busy} onClick={() => { track('stock_method_chosen', { method: 'paste' }); setStep("paste"); }}>
                <span><ClipboardList /></span>
                Pegar lista
              </button>
              <button disabled={busy} onClick={() => toAlternative("manual")}>
                <span><Plus /></span>
                A mano
              </button>
            </div>
            {appSession?.membership?.role === "OWNER" &&
              appSession.store?.onboardingStartedAt && (
                <button
                  className="onb-sample"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      track('stock_method_chosen', { method: 'sample' });
                      if (!user) return;
                      await createSampleStock(user);
                      await finish("dashboard", "sample");
                    })
                  }
                >
                  <Sparkles size={18} />
                  <span>
                    <b>Probar con datos de ejemplo</b>
                    <small>
                      Los borrás con un toque
                    </small>
                  </span>
                  ›
                </button>
              )}
            {inventory.length > 0 && (
              <button
                className="onb-primary"
                disabled={busy}
                onClick={() => { track('stock_method_chosen', { method: 'go_inventory' }); void run(() => finish("inventory")); }}
              >
                Ir a mi inventario
              </button>
            )}
            <button
              className="onb-link onb-skip"
              disabled={busy}
              onClick={() => { track('stock_method_chosen', { method: 'skip' }); void run(() => finish("dashboard", "skip")); }}
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
                  {recognizedLinesHeading(
                    text.split("\n").filter((line) => line.trim()).length -
                      discarded.length,
                    text.split("\n").filter((line) => line.trim()).length,
                  )}
                </b>
                <p>{unrecognizedNote(discarded.length)}</p>
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
              {step === "paste" && (
                <button className="onb-link" onClick={() => file.current?.click()}>
                  <FileText size={18} /> Subir .txt
                </button>
              )}
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
          <section aria-live="polite" data-testid="onboarding-analyzing">
            <span className="onb-loading">
              <Sparkles size={32} />
            </span>
            <h1>Estamos leyendo tu lista</h1>
            <p>
              Reconocemos los equipos y sus precios. Vos revisás antes de
              guardar.
            </p>
            {partialRows.length === 0 ? (
              <div className="onb-progress-indeterminate" />
            ) : (
              <progress
                value={analyzeStep?.done ?? 0}
                max={analyzeStep?.total ?? 1}
                aria-label="Avance del análisis"
              />
            )}
            <b data-testid="onboarding-analyze-status">
              {partialRows.length === 0
                ? readingLinesLabel(lineCount)
                : esCount(
                    partialRows.reduce((sum, row) => sum + row.quantity, 0),
                    "equipo reconocido",
                    "equipos reconocidos",
                  )}
            </b>
            {analyzeStep && partialRows.length > 0 && (
              <p data-testid="onboarding-analyze-part">
                Parte {analyzeStep.done} de {analyzeStep.total}
              </p>
            )}
            <ul className="onb-partials">
              {partialRows.map((row, index) => (
                <li key={`${row.model}-${index}`}>
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
                track('stock_import_abandoned', { method: 'paste', at: 'analyze' });
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
            <p>
              Armamos {esCount(totals.count, "equipo", "equipos")}. Revisá los
              marcados y guardá.
            </p>
            <div className="onb-result-layout">
              <div>
                <section className="onb-value">
                  <h2>Valor de tu stock</h2>
                  <strong data-testid="onboarding-stock-usd">
                    US$ <ReplayValue>{fmt(totals.usd)}</ReplayValue>
                  </strong>
                  <p>
                    ≈ $ <ReplayValue>{fmt(totals.ars)}</ReplayValue>{" "}
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
                  {totals.withoutCurrency > 0 && (
                    <p data-testid="onboarding-without-currency" role="note">
                      {withoutCurrencyNote(totals.withoutCurrency)}
                    </p>
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
                  REVISIÓN RÁPIDA{" "}
                  <span>
                    {totals.review}{" "}
                    {totals.review === 1 ? "CON DUDA" : "CON DUDAS"}
                  </span>
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
                        {row.currency !== "USD" && row.currency !== "ARS"
                          ? "Sin moneda"
                          : row._review
                            ? "Revisar"
                            : row.price?.trim() ? <ReplayValue>{`${row.currency === "USD" ? "US$" : "$"} ${fmt(parseImportNumber(row.price) ?? 0)}`}</ReplayValue> : "A definir"}
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
                  : `Guardar ${esCount(totals.count, "equipo", "equipos")} e ir al inventario`}
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
          onClose={closeAlternative}
          onStageChange={(at) => { importStage.current = at; }}
          onAnalyze={(sheets) => analyzeImport(user, "inventory", sheets)}
          onApply={(sheets, plan, refresh) =>
            applyImportPlan(user, "inventory", sheets, plan, refresh)
          }
          onImport={async (imported, definitions) => {
            let result: Awaited<ReturnType<typeof importBackendRows>>;
            try {
              result = await importBackendRows(
                user,
                "inventory",
                inventoryImportPayload(imported),
                undefined,
                'excel',
                definitions,
              );
            } catch (cause) {
              importFinished('excel', 0, 1);
              throw cause;
            }
            importFinished('excel', result.imported + result.updated, result.errors.length);
            if (!result.errors.length) await finish("inventory");
            else await reloadInventory();
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
                go: closeAlternative,
                open: () => undefined,
                close: closeAlternative,
                toast: () => undefined,
                isStaff: false,
              }}
            >
              <DeskOverlays overlay={{ type: "new-eq" }} onSaved={() => importFinished("manual", 1, 0)} />
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
                value={rows[editing].currency || ""}
                onChange={(e) => change("currency", e.target.value)}
              >
                <option value="">Sin moneda</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
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
