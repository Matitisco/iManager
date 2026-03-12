import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';

export const SaleForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { clients, inventory, addSale } = useAppContext();
  
  const availableProducts = useMemo(() =>
    inventory.filter(p => p.status === 'DISPONIBLE'),
    [inventory]
  );

  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    productId: availableProducts[0]?.id || '',
    paymentMethod: 'TRANSFERENCIA' as any,
  });

  const selectedProduct = useMemo(() =>
    availableProducts.find(p => p.id === formData.productId),
    [availableProducts, formData.productId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    addSale({
      date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }),
      clientId: formData.clientId,
      productId: formData.productId,
      amount: selectedProduct.price,
      paymentMethod: formData.paymentMethod,
      status: 'COMPLETADA'
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
      
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Producto a Vender</label>
        <select required className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.productId} onChange={e => setFormData({...formData, productId: e.target.value})}>
          {availableProducts.map(p => <option key={p.id} value={p.id}>{p.model} - {p.capacity} ({p.imei})</option>)}
        </select>
      </div>

      {selectedProduct && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Monto a cobrar:</span>
          <span className="text-lg font-black text-gray-900">${selectedProduct.price.toLocaleString()}</span>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Método de Pago</label>
        <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value as any})}>
          <option>TRANSFERENCIA</option>
          <option>EFECTIVO</option>
          <option>TARJETA</option>
          <option>CANJE / PAGO</option>
        </select>
      </div>
      
      <div className="pt-4 flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800">Registrar Venta</button>
      </div>
    </form>
  );
};
