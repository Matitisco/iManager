import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { previewInvitation, type InvitationPreview } from '../services/invitations-api';
import { trimToString } from '../lib/utils';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Socio',
  SELLER: 'Vendedor',
};

interface OnboardingProps {
  inviteToken?: string | null;
}

export function Onboarding({ inviteToken }: OnboardingProps) {
  const { appSession, completeOnboarding, acceptStoreInvitation, logout } = useAppContext();
  const [storeName, setStoreName] = useState(trimToString(appSession?.user.displayName));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Invite mode state
  const [invitePreview, setInvitePreview] = useState<InvitationPreview | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

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

  // If we have a token, preview the invitation
  useEffect(() => {
    if (!inviteToken) return;
    setInviteLoading(true);
    previewInvitation(inviteToken)
      .then((data) => {
        if (data) {
          setInvitePreview(data);
        } else {
          setInviteInvalid(true);
        }
      })
      .catch(() => setInviteInvalid(true))
      .finally(() => setInviteLoading(false));
  }, [inviteToken]);

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setError('');
    setIsSubmitting(true);
    try {
      await acceptStoreInvitation(inviteToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateStore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await completeOnboarding(storeName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el onboarding');
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

  // ── Invite mode ──────────────────────────────────────────────────────────

  if (inviteToken && inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (inviteToken && invitePreview && !inviteInvalid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-[2rem] shadow-sm p-8 md:p-10">
          <div className="flex flex-col items-center text-center gap-4">
            {avatar}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Te invitaron a una tienda</h1>
              <p className="mt-2 text-gray-500">
                Vas a unirte a <strong className="text-gray-900">{invitePreview.storeName}</strong> como{' '}
                <strong className="text-gray-900">{ROLE_LABELS[invitePreview.role] ?? invitePreview.role}</strong>.
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
              {isSubmitting ? 'Uniéndote...' : `Unirme a ${invitePreview.storeName}`}
            </button>
          </div>

          {logoutLink}
        </div>
      </div>
    );
  }

  if (inviteToken && inviteInvalid) {
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
              type="submit"
              disabled={isSubmitting || !trimToString(storeName)}
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

  // ── Normal onboarding (create store) ─────────────────────────────────────

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
            type="submit"
            disabled={isSubmitting || !trimToString(storeName)}
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
