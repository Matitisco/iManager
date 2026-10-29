import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { toActionMessage } from "../lib/user-message";
import { onboardingTotals } from "../lib/onboarding-stock";
import { deleteSampleStock } from "../services/getting-started-api";
import { canViewTeam } from "./sections";
import { isInStock, statusLabel } from "./format";
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
  const equipment = inventory.filter((item) => !item.archivedAt);
  const counts = new Map<string, number>([
    ['DISPONIBLE', 0], ['EN_REVISION', 0], ['RESERVADO', 0], ['VENDIDO', 0],
  ]);
  for (const item of equipment) {
    const status = item.status || 'DISPONIBLE';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const breakdown = [...counts].filter(([, count]) => count > 0).map(([status, count]) => {
    const label = status === 'DISPONIBLE' ? (count === 1 ? 'disponible' : 'disponibles')
      : status === 'RESERVADO' ? (count === 1 ? 'reservado' : 'reservados')
      : status === 'VENDIDO' ? (count === 1 ? 'vendido' : 'vendidos')
      : statusLabel(status).toLocaleLowerCase('es-AR');
    return `${count} ${label}`;
  }).join(' · ');
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
        <small>Equipos</small>
        <b>{equipment.length}</b>
        {breakdown ? <small className="first-stock-breakdown">{breakdown}</small> : null}
      </span>
      <span>
        <small>{withoutPrice ? "Valor con precio" : "Valor del stock"}</small>
        <b data-ph-mask>{withoutPrice === stock.length && withoutPrice > 0 ? "A definir" : `US$ ${number(totals.usd)}`}</b>
        <small data-ph-mask>{withoutPrice ? `${withoutPrice} con precio a definir` : `≈ $ ${number(totals.ars)}`}</small>
      </span>
    </div>
  );
}
