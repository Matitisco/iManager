import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useInvitationPreview } from '../hooks/useInvitationPreview';
import { INPUT_LIMITS, limitedText } from '../lib/input-limits';
import { getFriendlyErrorMessage, trimToString } from '../lib/utils';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Socio',
  STAFF: 'Empleado',
};

interface OnboardingProps {
  inviteToken?: string | null;
  onInviteAccepted?: () => void;
}

export function Onboarding({ inviteToken, onInviteAccepted }: OnboardingProps) {
  const { appSession, completeOnboarding, acceptStoreInvitation, logout } = useAppContext();
  const [storeName, setStoreName] = useState(trimToString(appSession?.user.displayName));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inviteState = useInvitationPreview(inviteToken);

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
    const nameError = limitedText('nombre', storeName, INPUT_LIMITS.storeName);
    if (nameError) {
      setError(nameError);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await completeOnboarding(trimToString(storeName));
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
      <p className="text-sm text-gray-600">{email}</p>
    </div>
  );

  const avatar = (
    <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center overflow-hidden">
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

  if (inviteToken && inviteState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-center px-6">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-[2rem] shadow-sm p-8 md:p-10">
          <div className="flex flex-col items-center text-center gap-4">
            {avatar}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Te invitaron a una tienda</h1>
              <p className="mt-2 text-gray-500">
                Vas a unirte a <strong className="text-gray-900">{inviteState.preview.storeName}</strong> como{' '}
                <strong className="text-gray-900">
                  {ROLE_LABELS[inviteState.preview.role] ?? inviteState.preview.role}
                </strong>.
              </p>
            </div>
            {userCard}
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleAcceptInvite()}
              className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Uniéndote...' : `Unirme a ${inviteState.preview.storeName}`}
            </button>
          </div>

          {logoutLink}
        </div>
      </div>
    );
  }

  if (inviteToken && inviteState.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-[2rem] shadow-sm p-8 md:p-10">
          <div className="flex flex-col items-center text-center gap-4">
            {avatar}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">No pudimos verificar la invitación todavía</h1>
              <p className="mt-2 text-gray-500">{inviteState.error}</p>
              <p className="mt-2 text-sm text-gray-500">
                El enlace puede seguir siendo válido. Volvé a intentar y solo te mostraremos crear una tienda si el backend confirma que la invitación no existe.
              </p>
            </div>
            {userCard}
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={inviteState.reload}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reintentar verificación
            </button>
          </div>

          {logoutLink}
        </div>
      </div>
    );
  }

  if (inviteToken && inviteState.invalid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-[2rem] shadow-sm p-8 md:p-10">
          <div className="flex flex-col items-center text-center gap-4">
            {avatar}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invitación inválida</h1>
              <p className="mt-2 text-gray-500">Esta invitación no es válida o ya expiró.</p>
            </div>
          </div>

          <p className="mt-6 text-sm text-center text-gray-500">
            Podés crear tu propia tienda para comenzar.
          </p>

          <form className="mt-4 space-y-4" onSubmit={(e) => void handleCreateStore(e)}>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
                {error}
              </div>
            )}
            <button
              data-testid="onboarding-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Creando tienda...' : 'Crear tienda y continuar'}
            </button>
          </form>

          {logoutLink}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-[2rem] shadow-sm p-8 md:p-10">
        <div className="flex flex-col items-center text-center gap-4">
          {avatar}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Creá tu tienda</h1>
            <p className="mt-2 text-gray-500">
              Ya iniciaste sesión. Ahora necesitamos crear la tienda para activar el contexto de negocio.
            </p>
          </div>
          {userCard}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={(e) => void handleCreateStore(e)}>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <button
            data-testid="onboarding-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Creando tienda...' : 'Crear tienda y continuar'}
          </button>
        </form>

        {logoutLink}
      </div>
    </div>
  );
}
