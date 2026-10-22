import { track } from '../lib/analytics';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { InstallHelp } from "../components/InstallHelp";
import { useAppContext } from "../context/AppContext";
import {
  canSeeFirstSteps,
  firstStepCount,
  firstStepsOnDashboard,
  nextFirstStep,
  orderedFirstSteps,
  type FirstStepFlags,
  type FirstStepId,
} from "../lib/first-steps";
import { isAppInstalled, installDismissedForever, subscribeInstall } from "../lib/pwa";
import { toUserMessage } from "../lib/user-message";
import { useDesk } from "./ui";

const EMPTY_FLAGS: FirstStepFlags = {
  store: false,
  stock: false,
  sale: false,
  team: false,
  install: false,
};

function flagsFromProgress(steps: Partial<FirstStepFlags> | undefined, fallback: FirstStepFlags): FirstStepFlags {
  return {
    store: steps?.store ?? fallback.store,
    stock: steps?.stock ?? fallback.stock,
    sale: steps?.sale ?? fallback.sale,
    team: steps?.team ?? fallback.team,
    install: steps?.install ?? fallback.install,
  };
}

function useFirstSteps() {
  const {
    gettingStarted: state,
    updateGettingStarted,
    refreshGettingStarted,
    inventory,
    sales,
    appSession,
  } = useAppContext();
  const { open } = useDesk();
  const [error, setError] = useState("");
  const [installation, setInstallation] = useState(false);
  const role = appSession?.membership?.role;
  const closeInstall = useCallback(() => setInstallation(false), []);

  useEffect(() => {
    void refreshGettingStarted?.();
  }, [refreshGettingStarted, inventory.length, sales.length]);

  useEffect(() => {
    if (!updateGettingStarted || !canSeeFirstSteps(role)) return;
    const changed = () => {
      if (!isAppInstalled()) return;
      void updateGettingStarted({ installed: true }).catch((cause) => setError(toUserMessage(cause)));
    };
    changed();
    return subscribeInstall(changed);
  }, [updateGettingStarted, role]);

  const flags = flagsFromProgress(state?.steps, {
    ...EMPTY_FLAGS,
    store: Boolean(state?.storeNamed),
    stock: (state?.stock ?? 0) >= 1,
    sale: Boolean(state?.sales),
    team: Boolean(state?.team),
    install: Boolean(state?.installed),
  });
  const steps = orderedFirstSteps(flags);
  const progress = firstStepCount(steps);
  const next = nextFirstStep(steps);

  const markInstalled = async () => {
    setError("");
    try {
      await updateGettingStarted?.({ installed: true, installedHow: 'manual' });
      setInstallation(false);
    } catch (cause) {
      setError(toUserMessage(cause));
    }
  };

  const run = (id: FirstStepId) => {
    track('first_steps_step_clicked', { step: id });
    if (id === "store") open({ type: "store" });
    else if (id === "stock") open({ type: "onboarding-stock" });
    else if (id === "sale") open({ type: "new-sale" });
    else if (id === "team") open({ type: "invite" });
    else setInstallation(true);
  };

  return {
    state,
    error,
    role,
    steps,
    progress,
    next,
    installation,
    closeInstall,
    markInstalled,
    run,
    completionKey: `imanager-first-steps-completed:${appSession?.user?.id ?? ""}:${appSession?.store?.id ?? ""}`,
    updateGettingStarted,
  };
}

function StepRows({
  steps,
  nextId,
  onRun,
  installHidden = false,
}: {
  steps: ReturnType<typeof orderedFirstSteps>;
  nextId?: FirstStepId;
  onRun: (id: FirstStepId) => void;
  installHidden?: boolean;
}) {
  return (
    <ol className="steps-list">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={step.done ? "is-done" : step.id === 'install' && installHidden ? 'is-install-hidden' : step.id === nextId ? "is-next" : ""}
          data-testid={`first-step-${step.id}`}
          data-done={step.done ? "true" : "false"}
        >
          {step.done || (step.id === 'install' && installHidden) ? (
            <>
              <span className={step.done ? 'steps-mark' : 'steps-num'} aria-hidden="true">{step.done ? <Check size={14} /> : index + 1}</span>
              <span className="steps-copy"><b>{step.title}</b><small>{step.done ? step.detail : 'Disponible en Ayuda'}</small></span>
            </>
          ) : (
            <button type="button" onClick={() => onRun(step.id)}>
              <span className="steps-num" aria-hidden="true">{index + 1}</span>
              <span className="steps-copy"><b>{step.title}</b><small>{step.detail}</small></span>
              {step.id === nextId ? <span className="steps-go">Empezar</span> : <ChevronRight size={18} aria-hidden="true" />}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function InstallGate({
  open,
  onClose,
  onInstalled,
}: {
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
}) {
  if (!open) return null;
  return <InstallHelp onClose={onClose} onInstalled={onInstalled} />;
}

export function FirstStepsIsland() {
  const model = useFirstSteps();
  return <FirstStepsIslandView key={model.completionKey} model={model} />;
}

function FirstStepsIslandView({ model }: { model: ReturnType<typeof useFirstSteps> }) {
  const installHidden = useSyncExternalStore(subscribeInstall, installDismissedForever);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(model.completionKey) === "true";
    } catch {
      return false;
    }
  });
  const [celebrating, setCelebrating] = useState(false);
  const seenIncomplete = useRef(false);
  const visible = firstStepsOnDashboard(model.state, model.role);
  const { done, total, complete } = model.progress;

  useEffect(() => {
    if (!visible || dismissed) return;
    if (!complete) {
      seenIncomplete.current = true;
      return;
    }
    // Persist immediately so a reload during the acknowledgement cannot replay it.
    try {
      localStorage.setItem(model.completionKey, "true");
    } catch {
      // The current session still hides the island when storage is unavailable.
    }
    if (seenIncomplete.current) setCelebrating(true);
    else setDismissed(true);
  }, [visible, dismissed, complete, model.completionKey]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => {
      setDismissed(true);
      setOpen(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  useEffect(() => {
    setHost(document.querySelector(".desk-app"));
  }, []);

  useEffect(() => {
    const root = document.querySelector(".desk-app");
    if (!root || !open || !visible || dismissed || complete) return;
    root.classList.add("steps-open");
    return () => root.classList.remove("steps-open");
  }, [open, visible, dismissed, complete]);

  if (!canSeeFirstSteps(model.role) || dismissed) return null;
  if (!model.state) return null;
  if (!visible || (complete && !celebrating)) return null;

  const node = (
    <>
      {open && !complete ? <div className="steps-scrim" onClick={() => setOpen(false)} /> : null}
      {complete ? (
        <div className="steps-pill is-done" data-testid="getting-started" data-complete="true" role="status">
          <span className="steps-done-mark" aria-hidden="true"><Check size={16} /></span>
          Listo · 5/5
        </div>
      ) : open ? (
        <section className="steps-panel" data-testid="getting-started" aria-label="Primeros pasos">
          <header>
            <div>
              <h2>Primeros pasos</h2>
              <p>{done} de {total} · a tu ritmo</p>
            </div>
            <button type="button" aria-label="Minimizar primeros pasos" onClick={() => setOpen(false)}>
              <ChevronDown size={18} />
            </button>
          </header>
          <progress value={done} max={total} aria-label="Progreso de primeros pasos" />
          <StepRows
            steps={model.steps}
            installHidden={installHidden}
            nextId={model.next?.id}
            onRun={(id) => {
              setOpen(false);
              model.run(id);
            }}
          />
          {model.error ? <p className="ferr" role="alert">{model.error}</p> : null}
        </section>
      ) : (
        <button className="steps-pill" type="button" data-testid="getting-started" aria-label={`Primeros pasos, ${done} de ${total}`} onClick={() => {
          setOpen(true);
          try {
            const key = `${model.completionKey}:opened`;
            const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
            if (localStorage.getItem(key) !== day) { localStorage.setItem(key, day); track('first_steps_opened', { done }); }
          } catch { /* Storage may be unavailable. */ }
        }}>
          <span className="steps-ring" style={{ background: `conic-gradient(#FFD000 ${(done / total) * 360}deg, #3A3D44 0deg)` }} aria-hidden="true">
            <span>{done}/{total}</span>
          </span>
          Primeros pasos
        </button>
      )}
      <InstallGate open={model.installation} onClose={model.closeInstall} onInstalled={() => void model.markInstalled()} />
    </>
  );

  return host ? createPortal(node, host) : node;
}

export function FirstStepsHelp() {
  const model = useFirstSteps();
  const [busy, setBusy] = useState(false);
  if (!canSeeFirstSteps(model.role)) return null;
  if (!model.state) return null;
  const onDashboard = firstStepsOnDashboard(model.state, model.role);
  const { done, total } = model.progress;
  return (
    <section className="first-steps" data-testid="getting-started" aria-label="Primeros pasos">
      <div className="first-heading">
        <div>
          <h2>Primeros pasos</h2>
          <p>{done} de {total} · a tu ritmo</p>
        </div>
      </div>
      <progress value={done} max={total} aria-label="Progreso de primeros pasos" />
      {!onDashboard ? (
        <button
          className="btn2 p first-show"
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void model.updateGettingStarted?.({ dismissed: false, visible: true }).finally(() => setBusy(false));
          }}
        >
          Mostrar en Dashboard
        </button>
      ) : null}
      <StepRows steps={model.steps} nextId={model.next?.id} onRun={model.run} />
      {model.error ? <p className="ferr" role="alert">{model.error}</p> : null}
      <InstallGate open={model.installation} onClose={model.closeInstall} onInstalled={() => void model.markInstalled()} />
    </section>
  );
}
