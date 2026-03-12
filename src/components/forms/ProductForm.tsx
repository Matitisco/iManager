import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export const ProductForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addProduct } = useAppContext();
  
  const [formData, setFormData] = useState({
    imei: '',
    model: '',
    capacity: '128GB',
    color: '',
    condition: 'NUEVO' as any,
    grade: 'A+' as any,
    batteryHealth: 100,
    cost: 0,
    price: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProduct({
      ...formData,
      status: 'DISPONIBLE'
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">IMEI</label>
        <input required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
          value={formData.imei} onChange={e => setFormData({...formData, imei: e.target.value})} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Modelo</label>
          <input required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
            value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Capacidad</label>
          <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})}>
            <option>64GB</option>
            <option>128GB</option>
            <option>256GB</option>
            <option>512GB</option>
            <option>1TB</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Color</label>
          <input required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
            value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Condición</label>
          <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value as any})}>
            <option>NUEVO</option>
            <option>USADO</option>
            <option>PRE-OWNED</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Grado Estético</label>
          <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value as any})}>
            <option>A+</option>
            <option>A</option>
            <option>B</option>
            <option>C</option>
            <option>N/A</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Salud Batería (%)</label>
          <input required type="number" min="1" max="100" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
            value={formData.batteryHealth} onChange={e => setFormData({...formData, batteryHealth: Number(e.target.value)})} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Costo ($)</label>
          <input required type="number" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
            value={formData.cost} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Precio Venta ($)</label>
          <input required type="number" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" 
            value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
        </div>
      </div>
      <div className="pt-4 flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800">Guardar Equipo</button>
      </div>
    </form>
  );
};
