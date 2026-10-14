import { useCallback, useState } from "react";
import { InstallHelp } from "../../components/InstallHelp";
import { GettingStarted } from "../getting-started";
import { canOpenSection, canViewTeam } from "../sections";
import { useAppContext } from "../../context/AppContext";
import { useDesk, ScreenTitle } from "../ui";
import { WELCOME_VIDEO_POSTER } from "../../components/WelcomeVideo";

export function HelpScreen() {
  const { open, back } = useDesk();
  const { appSession } = useAppContext();
  const role = appSession?.membership?.role;
  const can = (id: string) =>
    canOpenSection(id, appSession?.membership?.sections, role);
  const [install, setInstall] = useState(false);
  const closeInstall = useCallback(() => setInstall(false), []);
  return (
    <div className="dscreen help-screen">
      <ScreenTitle
        title="Ayuda"
        desktop={null}
        subtitle="Videos y guías para usar iManager"
        back={back}
      />
      <button
        className="help-video"
        onClick={() => open({ type: "welcome-video" })}
      >
        <img src={WELCOME_VIDEO_POSTER} alt="" loading="lazy" />
        <span>
          <b>Video de bienvenida</b>
          <small>
            Los pasos para empezar: stock, ventas, equipo e instalación.
          </small>
        </span>
      </button>
      <button
        className="btn2 p"
        onClick={() => open({ type: "welcome-video" })}
      >
        ▶ Ver video de bienvenida
      </button>
      <h2>Guías</h2>
      <div className="card help-guides">
        {can("inventory") && (
          <button onClick={() => open({ type: "onboarding-stock" })}>
            Cargar mi stock <span>›</span>
          </button>
        )}
        {can("sales") && (
          <button onClick={() => open({ type: "new-sale" })}>
            Registrar una venta con canje <span>›</span>
          </button>
        )}
        {canViewTeam(role) && (
          <button onClick={() => open({ type: "invite" })}>
            Invitar a un empleado y darle permisos <span>›</span>
          </button>
        )}
        <button onClick={() => setInstall(true)}>
          Instalar la app en el celular <span>›</span>
        </button>
      </div>
      <GettingStarted force />
      {install && <InstallHelp onClose={closeInstall} />}
    </div>
  );
}
