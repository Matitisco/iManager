import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useInvitationPreview } from '../hooks/useInvitationPreview';
import { INPUT_LIMITS, limitedText } from '../lib/input-limits';
import { useKeyboardInset, usePhoneLayout } from '../lib/phone-layout';
import { getFriendlyErrorMessage, trimToString } from '../lib/utils';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Socio',
  STAFF: 'Empleado',
};

type StoreCurrency = 'ARS' | 'USD';
type ExchangeMode = 'auto' | 'manual';
type ExchangeSource = 'blue' | 'oficial' | 'mep';

function rateOrNull(value: string) {
  const digits = value.replace(/\D/g, '');
  const amount = digits ? Number(digits) : 0;
  return amount > 0 ? amount : null;
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
  const field = 'w-full max-w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white max-[760px]:text-base';
  return (
    <>
      <div>
        <label htmlFor="onboarding-currency" className="block text-sm font-medium text-gray-700 mb-2">Moneda principal</label>
        <select id="onboarding-currency" data-testid="onboarding-currency" className={field} value={currency} disabled={disabled} onChange={(event) => onCurrency(event.target.value as StoreCurrency)}>
          <option value="ARS">Pesos (ARS)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </div>
      <div>
        <label htmlFor="onboarding-exchange-mode" className="block text-sm font-medium text-gray-700 mb-2">Cotización del dólar</label>
        <select id="onboarding-exchange-mode" data-testid="onboarding-exchange-mode" className={field} value={mode} disabled={disabled} onChange={(event) => onMode(event.target.value as ExchangeMode)}>
          <option value="auto">Automática desde DolarApi</option>
          <option value="manual">Manual, la carga la tienda</option>
        </select>
      </div>
      {mode === 'auto' ? (
        <div>
          <label htmlFor="onboarding-exchange-source" className="block text-sm font-medium text-gray-700 mb-2">Tipo de dólar</label>
          <select id="onboarding-exchange-source" data-testid="onboarding-exchange-source" className={field} value={source} disabled={disabled} onChange={(event) => onSource(event.target.value as ExchangeSource)}>
            <option value="blue">Blue</option>
            <option value="oficial">Oficial</option>
            <option value="mep">MEP</option>
          </select>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-[760px]:grid-cols-1">
          <div>
            <label htmlFor="onboarding-manual-buy" className="block text-sm font-medium text-gray-700 mb-2">Compra</label>
            <input id="onboarding-manual-buy" data-testid="onboarding-manual-buy" inputMode="numeric" className={field} value={manualBuy} disabled={disabled} placeholder="Ej. 1200" onChange={(event) => onManualBuy(event.target.value.replace(/\D/g, '').slice(0, 8))} />
          </div>
          <div>
            <label htmlFor="onboarding-manual-sell" className="block text-sm font-medium text-gray-700 mb-2">Venta</label>
            <input id="onboarding-manual-sell" data-testid="onboarding-manual-sell" inputMode="numeric" className={field} value={manualSell} disabled={disabled} placeholder="Ej. 1250" onChange={(event) => onManualSell(event.target.value.replace(/\D/g, '').slice(0, 8))} />
          </div>
        </div>
      )}
    </>
  );
}

const primaryButton =
  'w-full py-3.5 bg-black text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-4 text-center max-[760px]:min-h-[52px] max-[760px]:bg-[#FFD000] max-[760px]:font-bold max-[760px]:text-[#16181D] max-[760px]:hover:opacity-100 max-[760px]:break-words max-[760px]:leading-snug';

const screenClass =
  'min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8 max-[760px]:h-dvh max-[760px]:min-h-0 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:justify-start max-[760px]:overflow-hidden max-[760px]:overflow-x-clip max-[760px]:bg-[#F7F8FA] max-[760px]:p-0';

const cardClass =
  'onb-card w-full max-w-xl bg-white border border-gray-200 rounded-[2rem] shadow-sm p-8 md:p-10 max-[760px]:flex max-[760px]:h-full max-[760px]:max-w-none max-[760px]:min-w-0 max-[760px]:flex-col max-[760px]:rounded-none max-[760px]:border-0 max-[760px]:bg-transparent max-[760px]:p-0 max-[760px]:shadow-none';

const stackClass = 'max-[760px]:flex max-[760px]:min-h-0 max-[760px]:min-w-0 max-[760px]:flex-1 max-[760px]:flex-col';

const scrollClass =
  'max-[760px]:mx-4 max-[760px]:mt-4 max-[760px]:min-h-0 max-[760px]:min-w-0 max-[760px]:grow-0 max-[760px]:shrink max-[760px]:basis-auto max-[760px]:overflow-y-auto max-[760px]:overflow-x-hidden max-[760px]:rounded-[28px] max-[760px]:border max-[760px]:border-[#E6E8EC] max-[760px]:bg-white max-[760px]:p-5 max-[760px]:shadow-sm';

const dockClass = 'mt-4 max-[760px]:mx-0 max-[760px]:mt-auto max-[760px]:w-full max-[760px]:shrink-0 max-[760px]:px-4 max-[760px]:pt-3';

function OnboardingLayout({
  phone,
  inset,
  children,
  dock,
  onSubmit,
}: {
  phone: boolean;
  inset: number;
  children: React.ReactNode;
  dock: React.ReactNode;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const screenStyle = phone ? { height: `calc(100dvh - ${inset}px)` } : undefined;
  const dockStyle = phone
    ? { paddingBottom: inset > 0 ? 12 : 'calc(12px + env(safe-area-inset-bottom, 0px))' }
    : undefined;
  const body = (
    <>
      <div data-testid="onboarding-scroll" className={scrollClass}>{children}</div>
      <div data-testid="onboarding-dock" className={dockClass} style={dockStyle}>{dock}</div>
    </>
  );

  return (
    <div data-testid="onboarding-screen" className={screenClass} style={screenStyle}>
      <div className={cardClass}>
        {onSubmit ? (
          <form className={stackClass} onSubmit={onSubmit}>{body}</form>
        ) : (
          <div className={stackClass}>{body}</div>
        )}
      </div>
    </div>
  );
}

interface OnboardingProps {
  inviteToken?: string | null;
  onInviteAccepted?: () => void;
}

export function Onboarding({ inviteToken, onInviteAccepted }: OnboardingProps) {
  const { appSession, completeOnboarding, acceptStoreInvitation, logout } = useAppContext();
  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState<StoreCurrency>('ARS');
  const [exchangeMode, setExchangeMode] = useState<ExchangeMode>('auto');
  const [exchangeSource, setExchangeSource] = useState<ExchangeSource>('blue');
  const [manualBuy, setManualBuy] = useState('');
  const [manualSell, setManualSell] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inviteState = useInvitationPreview(inviteToken);
  const phone = usePhoneLayout();
  const keyboardInset = useKeyboardInset(phone);

  const email = appSession?.user.email ?? '';
  const avatarUrl = appSession?.user.avatarUrl ?? '';

  const initials = useMemo(() => {
    const base = trimToString(appSession?.user.displayName) || email || 'iManager';
    const result = base
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
    return result || 'IM';
  }, [appSession?.user.displayName, email]);

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setError('');
    setIsSubmitting(true);
    try {
      await acceptStoreInvitation(inviteToken);
      onInviteAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateStore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedStoreName = trimToString(storeName);
    if (!trimmedStoreName) {
      setError('Completá el nombre de la tienda');
      return;
    }
    const nameError = limitedText('nombre', trimmedStoreName, INPUT_LIMITS.storeName);
    if (nameError) {
      setError(nameError);
      return;
    }

    if (exchangeMode === 'manual' && ((manualBuy && !manualSell) || (!manualBuy && manualSell))) {
      setError('Completá compra y venta, o dejalas vacías.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        storeName: trimmedStoreName,
        currency,
        exchangeMode,
        exchangeSource,
        manualBuy: exchangeMode === 'manual' ? rateOrNull(manualBuy) : null,
        manualSell: exchangeMode === 'manual' ? rateOrNull(manualSell) : null,
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo completar el onboarding'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const userCard = (
    <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left">
      <p className="text-sm text-gray-500">Usuario autenticado</p>
      <p className="font-semibold text-gray-900">{appSession?.user.displayName || 'Sin nombre'}</p>
      <p className="text-sm text-gray-600 max-[760px]:break-all">{email}</p>
    </div>
  );

  const avatar = (
    <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center overflow-hidden max-[760px]:rounded-[22px] max-[760px]:bg-[#FFD000] max-[760px]:text-[#16181D]">
      {avatarUrl ? (
        <img src={avatarUrl} alt={appSession?.user.displayName || 'Usuario'} className="w-full h-full object-cover" />
      ) : (
        <span className="text-lg font-bold">{initials}</span>
      )}
    </div>
  );

  const logoutLink = (
    <div className="mt-4 text-center">
      <button
        type="button"
        className="text-sm text-gray-500 hover:text-gray-900 underline"
        onClick={() => void logout()}
      >
        Cerrar sesión
      </button>
    </div>
  );

  const titleClass = 'text-3xl font-bold text-gray-900 max-[760px]:text-2xl max-[760px]:break-words';
  const storeInputClass = 'w-full max-w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all max-[760px]:text-base';
  const currencyFields = (
    <CurrencySetup
      currency={currency}
      mode={exchangeMode}
      source={exchangeSource}
      manualBuy={manualBuy}
      manualSell={manualSell}
      disabled={isSubmitting}
      onCurrency={setCurrency}
      onMode={setExchangeMode}
      onSource={setExchangeSource}
      onManualBuy={setManualBuy}
      onManualSell={setManualSell}
    />
  );

  if (inviteToken && inviteState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 max-[760px]:h-dvh max-[760px]:overflow-hidden max-[760px]:bg-[#F7F8FA]">
        <div className="flex max-w-full flex-col items-center gap-3 px-2 text-center">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {inviteState.isRetrying ? 'Reintentando verificación…' : 'Verificando invitación…'}
            </p>
            <p className="text-sm text-gray-500">
              {inviteState.isRetrying
                ? 'La tienda tarda en responder, seguimos intentando antes de mostrarte otras opciones.'
                : 'Estamos validando el enlace antes de unirte a la tienda.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (inviteToken && inviteState.preview && !inviteState.invalid) {
    return (
      <OnboardingLayout
        phone={phone}
        inset={keyboardInset}
        dock={(
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleAcceptInvite()}
              className={primaryButton}
            >
              {isSubmitting ? 'Uniéndote...' : `Unirme a ${inviteState.preview.storeName}`}
            </button>
            {logoutLink}
          </>
        )}
      >
        <div className="flex flex-col items-center text-center gap-4">
          {avatar}
          <div className="min-w-0 max-w-full">
            <h1 className={titleClass}>Te invitaron a una tienda</h1>
            <p className="mt-2 text-gray-500 break-words">
              Vas a unirte a <strong className="text-gray-900">{inviteState.preview.storeName}</strong> como{' '}
              <strong className="text-gray-900">
                {ROLE_LABELS[inviteState.preview.role] ?? inviteState.preview.role}
              </strong>.
            </p>
          </div>
          {userCard}
        </div>
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm break-words">
            {error}
          </div>
        )}
      </OnboardingLayout>
    );
  }

  if (inviteToken && inviteState.error) {
    return (
      <OnboardingLayout
        phone={phone}
        inset={keyboardInset}
        dock={(
          <>
            <button
              type="button"
              onClick={inviteState.reload}
              disabled={isSubmitting}
              className={primaryButton}
            >
              Reintentar verificación
            </button>
            {logoutLink}
          </>
        )}
      >
        <div className="flex flex-col items-center text-center gap-4">
          {avatar}
          <div className="min-w-0 max-w-full">
            <h1 className={titleClass}>No pudimos verificar la invitación todavía</h1>
            <p className="mt-2 text-gray-500 break-words">{inviteState.error}</p>
            <p className="mt-2 text-sm text-gray-500">
              El enlace puede seguir siendo válido. Volvé a intentar y solo te mostraremos crear una tienda si el backend confirma que la invitación no existe.
            </p>
          </div>
          {userCard}
        </div>
      </OnboardingLayout>
    );
  }

  if (inviteToken && inviteState.invalid) {
    return (
      <OnboardingLayout
        phone={phone}
        inset={keyboardInset}
        onSubmit={(event) => void handleCreateStore(event)}
        dock={(
          <>
            <button data-testid="onboarding-submit" type="submit" disabled={isSubmitting} className={primaryButton}>
              {isSubmitting ? 'Creando tienda...' : 'Crear tienda y continuar'}
            </button>
            {logoutLink}
          </>
        )}
      >
        <div className="flex flex-col items-center text-center gap-4">
          {avatar}
          <div className="min-w-0 max-w-full">
            <h1 className={titleClass}>Invitación inválida</h1>
            <p className="mt-2 text-gray-500">Esta invitación no es válida o ya expiró.</p>
          </div>
        </div>
        <p className="mt-6 text-sm text-center text-gray-500">
          Podés crear tu propia tienda para comenzar.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la tienda
            </label>
            <input
              id="storeName"
              data-testid="onboarding-store-name"
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="iManager Store"
              className={storeInputClass}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          {currencyFields}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm break-words">
              {error}
            </div>
          )}
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      phone={phone}
      inset={keyboardInset}
      onSubmit={(event) => void handleCreateStore(event)}
      dock={(
        <>
          <button data-testid="onboarding-submit" type="submit" disabled={isSubmitting} className={primaryButton}>
            {isSubmitting ? 'Creando tienda...' : 'Crear tienda y continuar'}
          </button>
          {logoutLink}
        </>
      )}
    >
      <div className="flex flex-col items-center text-center gap-4">
        {avatar}
        <div className="min-w-0 max-w-full">
          <h1 className={titleClass}>Creá tu tienda</h1>
          <p className="mt-2 text-gray-500">
            Ya iniciaste sesión. Ahora necesitamos crear la tienda para activar el contexto de negocio.
          </p>
        </div>
        {userCard}
      </div>
      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm break-words">
          {error}
        </div>
      )}
      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de la tienda
          </label>
          <input
            id="storeName"
            data-testid="onboarding-store-name"
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="iManager Store"
            className={storeInputClass}
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        {currencyFields}
      </div>
    </OnboardingLayout>
  );
}
