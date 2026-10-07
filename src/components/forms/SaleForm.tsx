import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatArDate } from '../../lib/ar-date';
import { getFriendlyErrorMessage } from '../../lib/utils';

type ClientMode = 'existing' | 'new';

export const SaleForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { clients, inventory, addSale, addClient } = useAppContext();

  const availableProducts = useMemo(() => inventory.filter(p => p.status === 'DISPONIBLE'), [inventory]);
  const defaultClientMode: ClientMode = clients.length > 0 ? 'existing' : 'new';

  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    productId: availableProducts[0]?.id || '',
    paymentMethod: 'TRANSFERENCIA' as any,
  });
  const [clientMode, setClientMode] = useState<ClientMode>(defaultClientMode);
  const [newClient, setNewClient] = useState({
    dni: '',
    name: '',
    email: '',
    phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = availableProducts.find(p => p.id === formData.productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      setError('Seleccioná un producto disponible para registrar la venta.');
      return;
    }

    if (clientMode === 'existing' && !formData.clientId) {
      setError('Seleccioná un cliente existente o cargá uno nuevo.');
      return;
    }

    if (clientMode === 'new') {
      const dni = newClient.dni.trim();
      const name = newClient.name.trim();

      if (!dni || !name) {
        setError('Completá DNI y nombre para crear el cliente.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const clientId =
        clientMode === 'new'
          ? (
              await addClient({
                dni: newClient.dni.trim(),
                name: newClient.name.trim(),
                email: newClient.email.trim(),
                phone: newClient.phone.trim(),
                lastPurchaseDate: 'N/A',
                totalSpent: 0,
                pendingBalance: 0,
              })
            ).id
          : formData.clientId;

      await addSale({
        date: formatArDate(new Date()),
        clientId,
        productId: formData.productId,
        amount: selectedProduct.price,
        paymentMethod: formData.paymentMethod,
        status: 'COMPLETADA'
      });

      onClose();
    } catch (submitError) {
      setError(getFriendlyErrorMessage(submitError, 'No se pudo registrar la venta.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Cliente</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setClientMode('existing')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
              clientMode === 'existing'
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-gray-50 text-gray-700'
            }`}
            disabled={clients.length === 0 || isSubmitting}
          >
            Existente
          </button>
          <button
            type="button"
            onClick={() => setClientMode('new')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
              clientMode === 'new'
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-gray-50 text-gray-700'
            }`}
            disabled={isSubmitting}
          >
            Nuevo
          </button>
        </div>
      </div>

      {clientMode === 'existing' ? (
        <div className="space-y-1">
          <label htmlFor="sale-client-existing" className="text-xs font-bold text-gray-700">Cliente existente</label>
          <select
            id="sale-client-existing"
            required
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.clientId}
            onChange={e => setFormData({ ...formData, clientId: e.target.value })}
            disabled={clients.length === 0}
          >
            {clients.length === 0 ? (
              <option value="">No hay clientes disponibles</option>
            ) : (
              clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.dni})</option>)
            )}
          </select>
          {clients.length === 0 && (
            <p className="text-xs text-amber-700">No hay clientes precargados. Podés crear uno nuevo en este mismo formulario.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="sale-client-dni" className="text-xs font-bold text-gray-700">DNI / ID</label>
            <input
              id="sale-client-dni"
              required
              type="text"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              value={newClient.dni}
              onChange={e => setNewClient({ ...newClient, dni: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="sale-client-name" className="text-xs font-bold text-gray-700">Nombre Completo</label>
            <input
              id="sale-client-name"
              required
              type="text"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              value={newClient.name}
              onChange={e => setNewClient({ ...newClient, name: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-bold text-gray-700">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              value={newClient.email}
              onChange={e => setNewClient({ ...newClient, email: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-bold text-gray-700">Teléfono</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              value={newClient.phone}
              onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="sale-product" className="text-xs font-bold text-gray-700">Producto a Vender</label>
        <select
          id="sale-product"
          required
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.productId}
          onChange={e => setFormData({ ...formData, productId: e.target.value })}
          disabled={availableProducts.length === 0}
        >
          {availableProducts.length === 0 ? (
            <option value="">No hay equipos disponibles</option>
          ) : (
            availableProducts.map(p => <option key={p.id} value={p.id}>{p.model} - {p.capacity} ({p.imei})</option>)
          )}
        </select>
        {availableProducts.length === 0 && (
          <p className="text-xs text-amber-700">Necesitás al menos un equipo disponible para registrar la venta.</p>
        )}
      </div>

      {selectedProduct && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Monto a cobrar:</span>
          <span className="text-lg font-black text-gray-900">${selectedProduct.price.toLocaleString()}</span>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Método de Pago</label>
        <select
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.paymentMethod}
          onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as any })}
        >
          <option>TRANSFERENCIA</option>
          <option>EFECTIVO</option>
          <option>TARJETA</option>
          <option>CANJE / PAGO</option>
        </select>
      </div>

      <div className="pt-4 flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50" disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando...' : 'Registrar Venta'}
        </button>
      </div>
    </form>
  );
};
