import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Play, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { InstallHelp } from "../components/InstallHelp";
import { isAppInstalled, subscribeInstall } from "../lib/pwa";
import { toUserMessage } from "../lib/user-message";
import { onboardingTotals } from "../lib/onboarding-stock";
import { deleteSampleStock } from "../services/getting-started-api";
import { canOpenSection, canViewTeam, canSeeFinancials } from "./sections";
import { isInStock, parseAppDate } from "./format";
import { useMoney } from "./exchange";
import { Dialog, useDesk } from "./ui";
import "./getting-started.css";

export function GettingStarted({ force = false }: { force?: boolean }) {
  const {
    gettingStarted: state,
    gettingStartedError,
    updateGettingStarted,
    refreshGettingStarted,
    inventory,
    sales,
    publicCatalog,
    appSession,
  } = useAppContext();
  const { open, go } = useDesk();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [installation, setInstallation] = useState(false);
  const closeInstall = useCallback(() => setInstallation(false), []);
  useEffect(() => {
    void refreshGettingStarted?.();
  }, [
    refreshGettingStarted,
    inventory.length,
    sales.length,
    publicCatalog?.active,
  ]);
  useEffect(() => {
    if (!updateGettingStarted) return;
    const changed = () => {
      if (isAppInstalled())
        void updateGettingStarted({ installed: true }).catch((cause) =>
          setError(toUserMessage(cause)),
        );
    };
    changed();
    return subscribeInstall(changed);
  }, [updateGettingStarted]);
  const update = async (dismissed: boolean) => {
    setBusy(true);
    setError("");
    try {
      await updateGettingStarted({ dismissed });
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  if (!state)
    return gettingStartedError &&
      (force || appSession?.store?.onboardingStartedAt) ? (
      <section className="first-steps" role="alert">
        <h2>Primeros pasos</h2>
        <p>{gettingStartedError}</p>
        <button className="btn2 s" onClick={() => void refreshGettingStarted()}>
          Reintentar
        </button>
      </section>
    ) : null;
  if (!force && (!state.eligible || state.dismissed)) return null;
  const role = appSession?.membership?.role;
  const sections = appSession?.membership?.sections;
  const tasks = [
    ...(canOpenSection("inventory", sections, role)
      ? [
          {
            id: "stock",
            title: "Cargá tu stock",
            sub: "Ves cuánto vale tu tienda",
            done: state.stock > 0,
            action: () => open({ type: "onboarding-stock" }),
          },
        ]
      : []),
    ...(canOpenSection("sales", sections, role)
      ? [
          {
            id: "sale",
            title: "Registrá tu primera venta",
            sub: "Con canje si hace falta",
            done: state.sales,
            action: () => open({ type: "new-sale" }),
          },
        ]
      : []),
    ...(canViewTeam(role)
      ? [
          {
            id: "team",
            title: "Invitá a tu equipo",
            sub: "Por link o email, con su rol",
            done: state.team,
            action: () => open({ type: "invite" }),
          },
        ]
      : []),
    ...(role === "OWNER"
      ? [
          {
            id: "catalog",
            title: "Compartí tu catálogo",
            sub: "Tu lista de precios por WhatsApp",
            done: state.catalog,
            action: () => go("publicCatalog"),
          },
        ]
      : []),
    {
      id: "install",
      title: "Instalá la app",
      sub: "Abrila como app en tu celular",
      done: state.installed,
      action: () => setInstallation(true),
    },
    {
      id: "video",
      title: "Mirá el video de bienvenida",
      sub: "Cuando quieras · opcional",
      done: state.videoWatched,
      action: () => open({ type: "welcome-video" }),
    },
  ];
  const required = tasks.filter((task) => task.id !== "video");
  const done = required.filter((task) => task.done).length;
  return (
    <section
      className="first-steps"
      aria-label="Primeros pasos"
      data-testid="getting-started"
    >
      <div className="first-heading">
        <div>
          <h2>Primeros pasos</h2>
          <p>
            {done} de {required.length} · lo hacés cuando quieras
          </p>
        </div>
        {!force && (
          <button
            aria-label="Cerrar Primeros pasos"
            disabled={busy}
            onClick={() => void update(true)}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <progress
        value={done}
        max={required.length}
        aria-label="Progreso de primeros pasos"
      />
      {tasks
        .filter((task) => !task.done)
        .map((task) => (
          <button
            className="first-task"
            key={task.id}
            data-testid={`first-step-${task.id}`}
            onClick={task.action}
          >
            <span className="first-check">
              {task.id === "video" ? (
                <Play size={12} fill="currentColor" />
              ) : null}
            </span>
            <span>
              <b>{task.title}</b>
              <small>{task.sub}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
      {tasks.every((task) => task.done) && (
        <p className="first-complete">
          <Check size={18} />
          ¡Completaste tus primeros pasos!
        </p>
      )}
      {force && state.eligible && state.dismissed && (
        <button
          className="btn2 s"
          disabled={busy}
          onClick={() => void update(false)}
        >
          Mostrar en Dashboard
        </button>
      )}
      {(error || gettingStartedError) && (
        <p className="ferr" role="alert">
          {error || gettingStartedError}
        </p>
      )}
      {installation && <InstallHelp onClose={closeInstall} />}
    </section>
  );
}

export function GettingStartedDashboard() {
  const { appSession, inventory, sales, clients } = useAppContext();
  const money = useMoney();
  const { open, go } = useDesk();
  const inStock = inventory.filter((item) => isInStock(item.status));
  const totals = onboardingTotals(
    inStock.map((item) => ({
      price: String(item.price),
      currency: item.currency || appSession?.store?.currency || "USD",
      quantity: "1",
      _review: "",
    })),
    money.rate,
  );
  const now = new Date();
  const canInventory = canOpenSection(
    "inventory",
    appSession?.membership?.sections,
    appSession?.membership?.role,
  );
  const canFinancials = canSeeFinancials(
    appSession?.membership?.sections,
    appSession?.membership?.role,
  );
  const monthSales = sales.filter((sale) => {
    const date = parseAppDate(sale.date);
    return (
      sale.status !== "CANCELADA" &&
      date?.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  });
  const monthTotal = money.sum(
    monthSales.map((sale) => ({
      amount: sale.amount,
      currency: sale.amountCurrency,
    })),
  );
  const number = (value: number | null) =>
    value === null
      ? "—"
      : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(
          value,
        );
  return (
    <div
      className={`dscreen first-dashboard${inventory.length === 0 ? " first-dashboard-empty" : ""}`}
    >
      <h1>Dashboard</h1>
      <p className="wsub">
        Hola, {appSession?.user.displayName?.split(" ")[0] || "¡bienvenido!"} ·{" "}
        {appSession?.store?.name}
      </p>
      {inventory.length === 0 && canInventory && (
        <section className="first-empty-stock">
          <h2>Tu inventario está vacío</h2>
          <p>
            Pegá tu lista de WhatsApp y en un minuto ves cuánto vale tu stock.
          </p>
          <button
            className="onb-yellow"
            onClick={() => open({ type: "onboarding-stock" })}
          >
            Cargar mi stock
          </button>
        </section>
      )}
      <div className="first-kpis">
        <div>
          <small>Stock</small>
          <b>
            {canInventory && inStock.length ? `US$ ${number(totals.usd)}` : "—"}
          </b>
          {canInventory && inStock.length > 0 && (
            <small>≈ $ {number(totals.ars)}</small>
          )}
        </div>
        <div>
          <small>Equipos</small>
          <b>{canInventory ? inStock.length : "—"}</b>
        </div>
        <div>
          <small>Ventas del mes</small>
          <b>{monthSales.length}</b>
        </div>
        <div>
          <small>Facturación del mes</small>
          <b>
            {canFinancials && monthTotal !== null
              ? money.showActive(monthTotal)
              : "—"}
          </b>
        </div>
      </div>
      <div className="first-dashboard-grid">
        {inventory.length > 0 && (
          <section className="first-activity">
            <h2>Tu stock, en un solo lugar</h2>
            <p>{inStock.length} equipos disponibles para tu próxima venta.</p>
            {canInventory && (
              <button className="btn2 p" onClick={() => go("inventory")}>
                Ver mi inventario
              </button>
            )}
            {sales.length > 0 && (
              <div className="first-recent">
                <h3>Ventas recientes</h3>
                {sales.slice(0, 4).map((sale) => (
                  <button
                    key={sale.id}
                    onClick={() => open({ type: "sale", id: sale.id })}
                  >
                    {clients.find((client) => client.id === sale.clientId)
                      ?.name ||
                      sale.clientName ||
                      "Venta"}
                    <b>{money.show(sale.amount, sale.amountCurrency)}</b>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        <GettingStarted />
      </div>
    </div>
  );
}

export function SampleStockBanner() {
  const {
    gettingStarted,
    user,
    inventory,
    refreshGettingStarted,
    reloadInventory,
    appSession,
  } = useAppContext();
  const { open } = useDesk();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void refreshGettingStarted?.();
  }, [inventory.length, refreshGettingStarted]);
  if (!gettingStarted?.samples) return null;
  const allowed = canViewTeam(appSession?.membership?.role);
  return (
    <>
      <div className="sample-banner" role="status">
        <span>Estás viendo datos de ejemplo</span>
        {allowed && (
          <>
            {" "}
            ·{" "}
            <button onClick={() => setConfirm(true)}>
              Borrar y cargar los míos
            </button>
          </>
        )}
      </div>
      {confirm && (
        <Dialog
          title="¿Borrar los datos de ejemplo?"
          text="Se eliminan únicamente los equipos de ejemplo. Tus equipos reales se conservan."
          ok="Borrar ejemplos"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
          busy={busy}
          error={error}
          onOk={() => {
            if (!user || busy) return;
            setBusy(true);
            setError(null);
            void deleteSampleStock(user)
              .then(async () => {
                await reloadInventory();
                await refreshGettingStarted();
                setConfirm(false);
                open({ type: "onboarding-stock" });
              })
              .catch((cause) => setError(toUserMessage(cause)))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </>
  );
}

export function OnboardingInventorySummary() {
  const { appSession, inventory } = useAppContext();
  const money = useMoney();
  if (!appSession?.store?.onboardingStartedAt) return null;
  const stock = inventory.filter((item) => isInStock(item.status));
  const totals = onboardingTotals(
    stock.map((item) => ({
      price: String(item.price),
      currency: item.currency || appSession.store!.currency,
      quantity: "1",
      _review: "",
    })),
    money.rate,
  );
  const number = (value: number | null) =>
    value === null
      ? "—"
      : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(
          value,
        );
  return (
    <div
      className="first-stock-summary"
      data-testid="onboarding-inventory-summary"
    >
      <span>
        <small>Equipos en stock</small>
        <b>{stock.length}</b>
      </span>
      <span>
        <small>Valor del stock</small>
        <b>US$ {number(totals.usd)}</b>
        <small>≈ $ {number(totals.ars)}</small>
      </span>
    </div>
  );
}
