import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export const ClientForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addClient } = useAppContext();
  
  const [formData, setFormData] = useState({
    dni: '',
    name: '',
    email: '',
    phone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addClient({
      ...formData,
      lastPurchaseDate: 'N/A',
      totalSpent: 0,
      pendingBalance: 0
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">DNI / ID</label>
        <input required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
          value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Nombre Completo</label>
        <input required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
          value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Email</label>
        <input required type="email" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
          value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Teléfono</label>
        <input required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
          value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
      </div>
      
      <div className="pt-4 flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800">Guardar Cliente</button>
      </div>
    </form>
  );
};
