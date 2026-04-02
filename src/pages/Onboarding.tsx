import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';

export function Onboarding() {
  const { appSession, completeOnboarding, logout } = useAppContext();
  const [storeName, setStoreName] = useState(appSession?.user.displayName?.trim() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const email = appSession?.user.email ?? '';
  const avatarUrl = appSession?.user.avatarUrl ?? '';

  const initials = useMemo(() => {
    const base = appSession?.user.displayName?.trim() || email || 'iManager';
    const result = base
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

    return result || 'IM';
  }, [appSession?.user.displayName, email]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await completeOnboarding(storeName);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo completar el onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-[2rem] shadow-sm p-8 md:p-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={appSession?.user.displayName || 'Usuario'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold">{initials}</span>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">Creá tu tienda</h1>
            <p className="mt-2 text-gray-500">
              Ya iniciaste sesión. Ahora necesitamos crear la tienda para activar el contexto de negocio.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left">
            <p className="text-sm text-gray-500">Usuario autenticado</p>
            <p className="font-semibold text-gray-900">{appSession?.user.displayName || 'Sin nombre'}</p>
            <p className="text-sm text-gray-600">{email}</p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la tienda
            </label>
            <input
              id="storeName"
              type="text"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              placeholder="iManager Store"
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !storeName.trim()}
            className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Creando tienda...' : 'Crear tienda y continuar'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-900 underline"
            onClick={() => void logout()}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
