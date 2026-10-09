import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatArDate } from '../../lib/ar-date';
import { INPUT_LIMITS } from '../../lib/input-limits';
import { getFriendlyErrorMessage } from '../../lib/utils';

type ClientMode = 'existing' | 'new';

export const TradeInForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { clients, inventory, addTradeIn, addClient } = useAppContext();

  const availableProducts = useMemo(() => inventory.filter(p => p.status === 'DISPONIBLE'), [inventory]);
  const defaultClientMode: ClientMode = clients.length > 0 ? 'existing' : 'new';

  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    deviceReceived: '',
    deviceReceivedImei: '',
    takeValue: 0,
    deviceGiven: availableProducts[0]?.id || '',
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

  const selectedProduct = availableProducts.find(p => p.id === formData.deviceGiven);
  const differencePaid = selectedProduct ? selectedProduct.price - formData.takeValue : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      setError('Seleccioná un equipo disponible para entregar.');
      return;
    }

    const deviceReceived = formData.deviceReceived.trim();
    const deviceReceivedImei = formData.deviceReceivedImei.trim();

    if (!deviceReceived || !deviceReceivedImei) {
      setError('Completá el equipo recibido y su IMEI.');
      return;
    }

    if (!Number.isFinite(formData.takeValue) || formData.takeValue < 0) {
      setError('El valor de toma debe ser un número válido mayor o igual a 0.');
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

      if (name.length > INPUT_LIMITS.clientName) {
        setError(`El nombre puede tener hasta ${INPUT_LIMITS.clientName} caracteres`);
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

      await addTradeIn({
        date: formatArDate(new Date()),
        clientId,
        deviceReceived,
        deviceReceivedImei,
        takeValue: formData.takeValue,
        deviceGiven: selectedProduct.model,
        differencePaid,
        status: 'PENDIENTE',
        batteryHealth: "100",
        grade: 'A'
      });

      onClose();
    } catch (submitError) {
      setError(getFriendlyErrorMessage(submitError, 'No se pudo registrar el canje.'));
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
          <label className="text-xs font-bold text-gray-700">Cliente existente</label>
          <select
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
            <label htmlFor="trade-in-client-dni" className="text-xs font-bold text-gray-700">DNI / ID</label>
            <input
              id="trade-in-client-dni"
              required
              type="text"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              value={newClient.dni}
              onChange={e => setNewClient({ ...newClient, dni: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="trade-in-client-name" className="text-xs font-bold text-gray-700">Nombre Completo</label>
            <input
              id="trade-in-client-name"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="trade-in-device-received" className="text-xs font-bold text-gray-700">Equipo Recibido</label>
          <input
            id="trade-in-device-received"
            required
            type="text"
            placeholder="Ej: iPhone 12 64GB"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.deviceReceived}
            onChange={e => setFormData({ ...formData, deviceReceived: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="trade-in-imei-received" className="text-xs font-bold text-gray-700">IMEI Recibido</label>
          <input
            id="trade-in-imei-received"
            required
            type="text"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.deviceReceivedImei}
            onChange={e => setFormData({ ...formData, deviceReceivedImei: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="trade-in-take-value" className="text-xs font-bold text-gray-700">Valor de Toma ($)</label>
        <input
          id="trade-in-take-value"
          required
          type="number"
          min="0"
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.takeValue}
          onChange={e => setFormData({ ...formData, takeValue: Number(e.target.value) })}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Equipo a Entregar</label>
        <select
          required
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.deviceGiven}
          onChange={e => setFormData({ ...formData, deviceGiven: e.target.value })}
          disabled={availableProducts.length === 0}
        >
          {availableProducts.length === 0 ? (
            <option value="">No hay equipos disponibles</option>
          ) : (
            availableProducts.map(p => <option key={p.id} value={p.id}>{p.model} - {p.capacity} (${p.price})</option>)
          )}
        </select>
        {availableProducts.length === 0 && (
          <p className="text-xs text-amber-700">Necesitás al menos un equipo disponible para registrar el canje.</p>
        )}
      </div>

      {selectedProduct && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Diferencia a abonar:</span>
          <span className={`text-lg font-black ${differencePaid >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${differencePaid.toLocaleString()}
          </span>
        </div>
      )}

      <div className="pt-4 flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50" disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando...' : 'Registrar Canje'}
        </button>
      </div>
    </form>
  );
};
