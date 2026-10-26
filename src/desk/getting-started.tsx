import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { toActionMessage } from "../lib/user-message";
import { onboardingTotals } from "../lib/onboarding-stock";
import { deleteSampleStock } from "../services/getting-started-api";
import { canViewTeam } from "./sections";
import { isInStock } from "./format";
import { useMoney } from "./exchange";
import { Dialog, useDesk } from "./ui";
import "./getting-started.css";

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
  const banner = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!gettingStarted?.samples) return null;
  const allowed = canViewTeam(appSession?.membership?.role);
  return (
    <>
      <div ref={banner} className="sample-banner" role="status">
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
      {confirm && createPortal(
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
              .catch((cause) => setError(toActionMessage(cause)))
              .finally(() => setBusy(false));
          }}
        />, banner.current?.closest('.desk-app') ?? document.body
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
      price: item.price == null ? "" : String(item.price),
      currency: item.currency || appSession.store!.currency,
      quantity: "1",
      _review: "",
    })),
    money.rate,
  );
  const withoutPrice = stock.filter(item => item.price == null).length;
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
        <small>{withoutPrice ? "Valor con precio" : "Valor del stock"}</small>
        <b>{withoutPrice === stock.length && withoutPrice > 0 ? "A definir" : `US$ ${number(totals.usd)}`}</b>
        <small>{withoutPrice ? `${withoutPrice} con precio a definir` : `≈ $ ${number(totals.ars)}`}</small>
      </span>
    </div>
  );
}
