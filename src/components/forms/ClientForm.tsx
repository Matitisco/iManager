import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { INPUT_LIMITS } from '../../lib/input-limits';
import { getFriendlyErrorMessage } from '../../lib/utils';

export const ClientForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addClient } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    dni: '',
    name: '',
    email: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dni = formData.dni.trim();
    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();

    if (!dni || !name) {
      setError('Completá DNI y nombre para crear el cliente.');
      return;
    }

    if (name.length > INPUT_LIMITS.clientName) {
      setError(`El nombre puede tener hasta ${INPUT_LIMITS.clientName} caracteres`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addClient({
        dni,
        name,
        email,
        phone,
        lastPurchaseDate: 'N/A',
        totalSpent: 0,
        pendingBalance: 0,
      });
      onClose();
    } catch (submitError) {
      setError(getFriendlyErrorMessage(submitError, 'No se pudo crear el cliente.'));
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
        <label htmlFor="client-dni" className="text-xs font-bold text-gray-700">DNI / ID</label>
        <input
          id="client-dni"
          required
          type="text"
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.dni}
          onChange={e => setFormData({ ...formData, dni: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="client-name" className="text-xs font-bold text-gray-700">Nombre Completo</label>
        <input
          id="client-name"
          required
          type="text"
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="client-email" className="text-xs font-bold text-gray-700">Email</label>
        <input
          id="client-email"
          type="email"
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.email}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Teléfono</label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.phone}
          onChange={e => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div className="pt-4 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
        </button>
      </div>
    </form>
  );
};
