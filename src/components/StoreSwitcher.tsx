import React, { useState } from 'react';
import { Check, ChevronDown, Plus, Store } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { AppMembershipRole } from '../types/app-session';

const ROLE_LABELS: Record<AppMembershipRole, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Socio',
  STAFF: 'Agente',
};

export function StoreSwitcher() {
  const { appSession, createOwnedStore, activateStore } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStore = appSession?.store;
  const stores = appSession?.stores ?? [];

  if (!currentStore) {
    return null;
  }

  const visibleStores = stores.length > 0
    ? stores
    : [{
        id: currentStore.id,
        name: currentStore.name,
        role: appSession.membership?.role ?? 'OWNER',
        isDefault: true,
      }];

  const handleActivate = async (storeId: string) => {
    if (storeId === currentStore.id || isSubmitting) {
      setIsOpen(false);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await activateStore(storeId);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar de tienda');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = storeName.trim();
    if (!name || isSubmitting) {
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await createOwnedStore(name);
      setStoreName('');
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tienda');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 pb-3">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left hover:bg-white"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-gray-900">
          <Store size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-gray-900">{currentStore.name}</span>
          <span className="block text-xs text-gray-500">
            {ROLE_LABELS[appSession.membership?.role ?? 'OWNER']}
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-2 space-y-3 rounded-2xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Tus tiendas</p>
          <div className="space-y-1">
            {visibleStores.map((store) => {
              const isCurrent = store.id === currentStore.id;
              return (
                <button
                  key={store.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleActivate(store.id)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{store.name}</span>
                    <span className="block text-xs text-gray-500">{ROLE_LABELS[store.role]}</span>
                  </span>
                  {isCurrent && <Check size={16} className="shrink-0 text-gray-900" aria-label="Tienda activa" />}
                </button>
              );
            })}
          </div>

          <form className="space-y-2 border-t border-gray-100 pt-3" onSubmit={(event) => void handleCreate(event)}>
            <label htmlFor="new-store-name" className="text-xs font-bold text-gray-700">
              Nueva tienda
            </label>
            <input
              id="new-store-name"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              placeholder="Nombre de la tienda"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-all focus:border-gray-300 focus:ring-2 focus:ring-black/10"
            />
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !storeName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-3 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Plus size={16} />
              {isSubmitting ? 'Guardando…' : 'Crear tienda'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
