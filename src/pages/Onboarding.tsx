import { useKeyboardInset, usePhoneLayout } from "../lib/phone-layout";
import { useState, type FormEvent, type CSSProperties } from "react";
import { useAppContext } from "../context/AppContext";
import { useInvitationPreview } from "../hooks/useInvitationPreview";
import { BrandLockup } from "../components/brand-mark";
import { toUserMessage } from "../lib/user-message";
import { manualQuoteOrderError } from "../lib/manual-quote";
import { ROLE_LABEL } from "../lib/roles";
import "./onboarding.css";
type StoreCurrency = "ARS" | "USD";
type ExchangeMode = "auto" | "manual";
type ExchangeSource = "blue" | "oficial" | "mep";
function rateOrNull(value: string) {
  const n = Number(value.replace(/\D/g, ""));
  return n > 0 ? n : null;
}
function CurrencySetup({
  currency,
  mode,
  source,
  manualBuy,
  manualSell,
  disabled,
  onCurrency,
  onMode,
  onSource,
  onManualBuy,
  onManualSell,
}: {
  currency: StoreCurrency;
  mode: ExchangeMode;
  source: ExchangeSource;
  manualBuy: string;
  manualSell: string;
  disabled: boolean;
  onCurrency: (value: StoreCurrency) => void;
  onMode: (value: ExchangeMode) => void;
  onSource: (value: ExchangeSource) => void;
  onManualBuy: (value: string) => void;
  onManualSell: (value: string) => void;
}) {
  const field =
    "w-full max-w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white max-[760px]:text-base";
  return (
    <>
      <div>
        <label
          htmlFor="onboarding-currency"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Moneda principal
        </label>
        <select
          id="onboarding-currency"
          data-testid="onboarding-currency"
          className={field}
          value={currency}
          disabled={disabled}
          onChange={(event) => onCurrency(event.target.value as StoreCurrency)}
        >
          <option value="ARS">Pesos (ARS)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </div>
      <div>
        <label
          htmlFor="onboarding-exchange-mode"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Cotización del dólar
        </label>
        <select
          id="onboarding-exchange-mode"
          data-testid="onboarding-exchange-mode"
          className={field}
          value={mode}
          disabled={disabled}
          onChange={(event) => onMode(event.target.value as ExchangeMode)}
        >
          <option value="auto">Automática desde DolarApi</option>
          <option value="manual">Manual, la carga la tienda</option>
        </select>
      </div>
      {mode === "auto" ? (
        <div>
          <label
            htmlFor="onboarding-exchange-source"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Tipo de dólar
          </label>
          <select
            id="onboarding-exchange-source"
            data-testid="onboarding-exchange-source"
            className={field}
            value={source}
            disabled={disabled}
            onChange={(event) => onSource(event.target.value as ExchangeSource)}
          >
            <option value="blue">Blue</option>
            <option value="oficial">Oficial</option>
            <option value="mep">MEP</option>
          </select>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-[760px]:grid-cols-1">
          <div>
            <label
              htmlFor="onboarding-manual-buy"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Compra
            </label>
            <input
              id="onboarding-manual-buy"
              data-testid="onboarding-manual-buy"
              inputMode="numeric"
              className={field}
              value={manualBuy}
              disabled={disabled}
              placeholder="Ej. 1200"
              onChange={(event) =>
                onManualBuy(event.target.value.replace(/\D/g, "").slice(0, 8))
              }
            />
          </div>
          <div>
            <label
              htmlFor="onboarding-manual-sell"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Venta
            </label>
            <input
              id="onboarding-manual-sell"
              data-testid="onboarding-manual-sell"
              inputMode="numeric"
              className={field}
              value={manualSell}
              disabled={disabled}
              placeholder="Ej. 1250"
              onChange={(event) =>
                onManualSell(event.target.value.replace(/\D/g, "").slice(0, 8))
              }
            />
          </div>
        </div>
      )}
    </>
  );
}

export function Onboarding({
  inviteToken,
  onInviteAccepted,
}: {
  inviteToken?: string | null;
  onInviteAccepted?: () => void;
}) {
  const { completeOnboarding, acceptStoreInvitation, logout } = useAppContext();
  const invite = useInvitationPreview(inviteToken);
  const phone = usePhoneLayout();
  const keyboardInset = useKeyboardInset(phone);
  const [storeName, setStoreName] = useState("");
  const [currency, setCurrency] = useState<StoreCurrency>("USD");
  const [mode, setMode] = useState<ExchangeMode>("auto");
  const [source, setSource] = useState<ExchangeSource>("blue");
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(toUserMessage(cause, "No se pudo crear la tienda."));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!storeName.trim()) {
      setError("Completá el nombre de la tienda");
      return;
    }
    if (storeName.trim().length > 120) {
      setError("El nombre puede tener hasta 120 caracteres");
      return;
    }
    if (mode === "manual") {
      if (Boolean(rateOrNull(buy)) !== Boolean(rateOrNull(sell))) {
        setError("Completá compra y venta, o dejalas vacías.");
        return;
      }
      const invalid = manualQuoteOrderError(
        rateOrNull(buy) ?? 0,
        rateOrNull(sell) ?? 0,
      );
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    void run(() =>
      completeOnboarding({
        storeName: storeName.trim(),
        currency,
        exchangeMode: mode,
        exchangeSource: source,
        manualBuy: mode === "manual" ? rateOrNull(buy) : null,
        manualSell: mode === "manual" ? rateOrNull(sell) : null,
      }),
    );
  };
  const invitation = Boolean(inviteToken && !invite.invalid);
  return (
    <div
      className="onb"
      data-testid="onboarding-screen"
      style={{ "--onb-keyboard-inset": `${keyboardInset}px` } as CSSProperties}
    >
      <header className="onb-header">
        <BrandLockup variant="horizontal" className="onb-logo" />
      </header>
      <main className="onb-main">
        {invitation ? (
          <section>
            <h1>
              {invite.isLoading
                ? invite.isRetrying
                  ? "Reintentando verificación…"
                  : "Verificando invitación…"
                : invite.error
                  ? "No pudimos verificar la invitación todavía"
                  : "Te invitaron a una tienda"}
            </h1>
            {invite.preview && (
              <p>
                Vas a unirte a <b>{invite.preview.storeName}</b> como{" "}
                {ROLE_LABEL[invite.preview.role]}.
              </p>
            )}
            {invite.error && <p role="alert">{invite.error}</p>}
            <div className="onb-dock" data-testid="onboarding-dock">
              {invite.error && (
                <button className="onb-primary" onClick={invite.reload}>
                  Reintentar verificación
                </button>
              )}
              {invite.preview && (
                <button
                  className="onb-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await acceptStoreInvitation(inviteToken!);
                      onInviteAccepted?.();
                    })
                  }
                >
                  {busy
                    ? "Uniéndote..."
                    : `Unirme a ${invite.preview.storeName}`}
                </button>
              )}
              <button className="onb-link" onClick={() => void logout()}>
                Cerrar sesión
              </button>
            </div>
          </section>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="onb-steps" aria-label="Paso 1 de 3">
              <i className="on" />
              <i />
              <i />
            </div>
            {invite.invalid && (
              <p className="onb-alert">
                Invitación inválida. Podés crear tu propia tienda.
              </p>
            )}
            <h1>¿Cómo se llama tu tienda?</h1>
            <p>
              Es lo único que necesitamos para arrancar. Lo ven tus clientes en
              el catálogo y los comprobantes.
            </p>
            <label className="sr-only" htmlFor="storeName">
              Nombre de la tienda
            </label>
            <input
              id="storeName"
              data-testid="onboarding-store-name"
              className="onb-name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="iManager Store"
              disabled={busy}
              autoComplete="organization"
            />
            <small>Lo podés cambiar cuando quieras en Configuración.</small>
            <details className="onb-currency">
              <summary>
                <span>
                  <b>Moneda y dólar</b>
                  <small>
                    Precios en {currency} · dólar{" "}
                    {mode === "auto" ? `${source} automático` : "manual"}
                  </small>
                </span>
                <span>Cambiar ›</span>
              </summary>
              <div className="onb-fields">
                <CurrencySetup
                  currency={currency}
                  mode={mode}
                  source={source}
                  manualBuy={buy}
                  manualSell={sell}
                  disabled={busy}
                  onCurrency={setCurrency}
                  onMode={setMode}
                  onSource={setSource}
                  onManualBuy={setBuy}
                  onManualSell={setSell}
                />
              </div>
            </details>
            {error && (
              <p className="onb-error" role="alert">
                {error}
              </p>
            )}
            <div className="onb-dock" data-testid="onboarding-dock">
              <button
                data-testid="onboarding-submit"
                className="onb-primary"
                disabled={busy}
              >
                {busy ? "Creando tienda…" : "Seguir"}
              </button>
            </div>
          </form>
        )}
        {invitation && error && (
          <p className="onb-error" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
