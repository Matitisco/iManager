import { useCallback, useState } from "react";
import { InstallHelp } from "../../components/InstallHelp";
import { FirstStepsHelp } from "../first-steps-island";
import { canOpenSection, canViewTeam } from "../sections";
import { useAppContext } from "../../context/AppContext";
import { useDesk, ScreenTitle } from "../ui";

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
        subtitle="Guías para usar iManager"
        back={back}
      />
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
      <FirstStepsHelp />
      {install && <InstallHelp onClose={closeInstall} />}
    </div>
  );
}
