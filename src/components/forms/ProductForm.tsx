import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { INPUT_LIMITS } from '../../lib/input-limits';
import { IMEI_FORMAT_MESSAGE, IMEI_OPTIONAL_LABEL, imeiFormatError } from '../../lib/imei';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { TagField } from '../TagField';
import { parseCellTags } from '../../utils/cell-tags';

export const ProductForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addProduct, customColumns } = useAppContext();
  const inventoryCustomColumns = customColumns.filter((column) => column.entity === 'inventory');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    imei: '',
    model: '',
    capacity: '128GB',
    color: '',
    condition: 'NUEVO' as any,
    grade: 'A+' as any,
    batteryHealth: '100',
    cost: 0,
    price: 0,
    customFields: {} as Record<string, string | number | string[]>
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const imei = formData.imei.trim();
    const model = formData.model.trim();
    const color = formData.color.trim();

    if (imeiFormatError(imei)) {
      setError(IMEI_FORMAT_MESSAGE);
      return;
    }

    if (!model || !color) {
      setError('Completá modelo y color para guardar el equipo.');
      return;
    }

    if (!formData.batteryHealth.trim()) {
      setError('Completá el campo de batería.');
      return;
    }

    if (model.length > INPUT_LIMITS.model) {
      setError(`El modelo puede tener hasta ${INPUT_LIMITS.model} caracteres`);
      return;
    }

    if (!Number.isFinite(formData.cost) || formData.cost < 0) {
      setError('El costo no puede ser negativo');
      return;
    }

    if (!Number.isFinite(formData.price) || formData.price < 0) {
      setError('El precio no puede ser negativo');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addProduct({
        ...formData,
        imei,
        model,
        color,
        status: 'DISPONIBLE'
      });
      onClose();
    } catch (submitError) {
      setError(getFriendlyErrorMessage(submitError, 'No se pudo guardar el equipo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="product-imei" className="text-xs font-bold text-gray-700">{IMEI_OPTIONAL_LABEL}</label>
        <input id="product-imei" type="text" inputMode="numeric" maxLength={15} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={formData.imei} onChange={e => setFormData({...formData, imei: e.target.value})} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="product-model" className="text-xs font-bold text-gray-700">Modelo</label>
          <input id="product-model" required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
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
          <label htmlFor="product-color" className="text-xs font-bold text-gray-700">Color</label>
          <input id="product-color" required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
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
          <label className="text-xs font-bold text-gray-700">Batería</label>
          <input required type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.batteryHealth} onChange={e => setFormData({...formData, batteryHealth: e.target.value})} placeholder="ej: 83-85% o 100" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="product-cost" className="text-xs font-bold text-gray-700">Costo ($)</label>
          <input id="product-cost" required type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.cost} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
        </div>
        <div className="space-y-1">
          <label htmlFor="product-price" className="text-xs font-bold text-gray-700">Precio Venta ($)</label>
          <input id="product-price" required type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
        </div>
      </div>

      {inventoryCustomColumns.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          {inventoryCustomColumns.map(col => (
            <div key={col.id} className="space-y-1">
              <label htmlFor={`product-custom-${col.id}`} className="text-xs font-bold text-gray-700">{col.label}</label>
              {col.type === 'tags' ? (
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <TagField
                    id={`product-custom-${col.id}`}
                    tags={parseCellTags(formData.customFields[col.id])}
                    onChange={(tags) => setFormData({
                      ...formData,
                      customFields: { ...formData.customFields, [col.id]: tags },
                    })}
                    placeholder="Agregar etiqueta"
                  />
                </div>
              ) : col.type === 'enum' ? (
                <select
                  id={`product-custom-${col.id}`}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  value={String(formData.customFields[col.id] || '')}
                  onChange={e => setFormData({
                    ...formData,
                    customFields: { ...formData.customFields, [col.id]: e.target.value },
                  })}
                >
                  <option value="">Elegir</option>
                  {(col.options ?? []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
              <input
                id={`product-custom-${col.id}`}
                type={col.type === 'number' ? 'number' : 'text'}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                value={String(formData.customFields[col.id] ?? '')}
                onChange={e => setFormData({
                  ...formData,
                  customFields: {
                    ...formData.customFields,
                    [col.id]: col.type === 'number' ? Number(e.target.value) : e.target.value
                  }
                })}
              />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50" disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar Equipo'}
        </button>
      </div>
    </form>
  );
};
