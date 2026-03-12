import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export const TradeInForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { clients, inventory, addTradeIn } = useAppContext();
  
  const availableProducts = inventory.filter(p => p.status === 'DISPONIBLE');

  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    deviceReceived: '',
    deviceReceivedImei: '',
    takeValue: 0,
    deviceGiven: availableProducts[0]?.id || '',
  });

  const selectedProduct = availableProducts.find(p => p.id === formData.deviceGiven);
  const differencePaid = selectedProduct ? selectedProduct.price - formData.takeValue : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    addTradeIn({
      date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }),
      clientId: formData.clientId,
      deviceReceived: formData.deviceReceived,
      deviceReceivedImei: formData.deviceReceivedImei,
      takeValue: formData.takeValue,
      deviceGiven: selectedProduct.model,
      differencePaid: differencePaid,
      status: 'PENDIENTE',
      batteryHealth: 100,
      grade: 'A'
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Cliente</label>
        <select required className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.dni})</option>)}
        </select>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Equipo Recibido</label>
          <input required type="text" placeholder="Ej: iPhone 12 64GB" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
            value={formData.deviceReceived} onChange={e => setFormData({...formData, deviceReceived: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">IMEI Recibido</label>
          <input required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
            value={formData.deviceReceivedImei} onChange={e => setFormData({...formData, deviceReceivedImei: e.target.value})} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Valor de Toma ($)</label>
        <input required type="number" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
          value={formData.takeValue} onChange={e => setFormData({...formData, takeValue: Number(e.target.value)})} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Equipo a Entregar</label>
        <select required className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.deviceGiven} onChange={e => setFormData({...formData, deviceGiven: e.target.value})}>
          {availableProducts.map(p => <option key={p.id} value={p.id}>{p.model} - {p.capacity} (${p.price})</option>)}
        </select>
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
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800">Registrar Canje</button>
      </div>
    </form>
  );
};
