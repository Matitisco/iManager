import { useState } from "react";
import { Users } from "lucide-react";
import { BrandLockup } from "../components/brand-mark";
import { WelcomeVideo } from "../components/WelcomeVideo";
import { useAppContext } from "../context/AppContext";
import { DeskOverlays } from "../desk/DeskOverlays";
import { DeskProvider } from "../desk/ui";
import type { Overlay } from "../desk/types";
import { toUserMessage } from "../lib/user-message";
import { StockOnboarding } from "./StockOnboarding";
import "./onboarding.css";
import "../desk/desk.css";

export function OnboardingJourney() {
  const {
    gettingStarted,
    appSession,
    updateGettingStarted,
    reloadSession,
    refreshGettingStarted,
  } = useAppContext();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stage =
    gettingStarted?.stage ?? appSession?.store?.onboardingStage ?? "video";
  const next = async () => {
    setBusy(true);
    setError("");
    try {
      await updateGettingStarted({
        stage: stage === "video" ? "invite" : "stock",
      });
      await reloadSession();
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  if (stage === "stock") return <StockOnboarding onFinish={() => undefined} />;
  const video = stage === "video";
  return (
    <DeskProvider
      value={{
        tab: "dashboard",
        openRecord: () => undefined,
        go: () => undefined,
        open: setOverlay,
        close: () => {
          setOverlay(null);
          void refreshGettingStarted();
        },
        toast: () => undefined,
        isStaff: false,
      }}
    >
      <div className="onb journey-onb" data-testid={`onboarding-${stage}`}>
        <header className="onb-header">
          <BrandLockup variant="horizontal" className="onb-logo" />
        </header>
        <main className="onb-main">
          <div className="onb-steps" aria-label={`Paso ${video ? 2 : 3} de 4`}>
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className={i <= (video ? 1 : 2) ? "on" : ""} />
            ))}
          </div>
          <h1>
            {video ? "Tu tienda, lista para empezar" : "Mejor con tu equipo"}
          </h1>
          <p>
            {video
              ? "Un video corto para conocer iManager. Podés verlo ahora o cuando quieras desde Ayuda."
              : "Sumá a quienes trabajan con vos. Cada persona entra con su cuenta y su rol."}
          </p>
          {video ? (
            <WelcomeVideo />
          ) : (
            <section className="onb-invite-card">
              <Users size={42} />
              <h2>Invitá a tus empleados</h2>
              <p>
                Compartí un link de invitación y elegí su rol. No necesitan
                crear otra tienda.
              </p>
              <button
                className="onb-yellow"
                onClick={() => setOverlay({ type: "invite" })}
              >
                Invitar al equipo
              </button>
              <small>
                {gettingStarted?.team
                  ? "✓ Ya se sumó alguien a tu equipo."
                  : "El paso se completa cuando se suma al menos una persona."}
              </small>
            </section>
          )}
          {error && (
            <p className="onb-error" role="alert">
              {error}
            </p>
          )}
          <div className="onb-dock">
            <button
              className="onb-primary"
              disabled={busy}
              onClick={() => void next()}
            >
              {busy ? "Guardando…" : "Seguir"}
            </button>
            <button
              className="onb-link"
              disabled={busy}
              onClick={() => void next()}
            >
              Saltar por ahora
            </button>
          </div>
        </main>
      </div>
      <div className="desk-app onb-desk-overlays">
        <DeskOverlays overlay={overlay} />
      </div>
    </DeskProvider>
  );
}
