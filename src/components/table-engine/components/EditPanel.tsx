import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Save } from 'lucide-react';
import type { WithId, EditPanelField } from '../types';

interface EditPanelProps<TRow extends WithId> {
  item: TRow | null;
  fields: EditPanelField<TRow>[];
  title?: string;
  onClose: () => void;
  onChange: (updated: TRow) => void;
  onSave: (item: TRow) => Promise<void>;
  onDelete?: (id: string) => void;
}

export function EditPanel<TRow extends WithId>({
  item, fields, title = 'Editar', onClose, onChange, onSave, onDelete,
}: EditPanelProps<TRow>) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true); setError(null);
    try { await onSave(item); onClose(); }
    catch (e: any) { setError(e?.message ?? 'Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-30"
            onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-40 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {fields.map(f => {
                const value = (item as any)[f.field] ?? '';
                return (
                  <div key={f.field} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{f.label}</label>
                    {f.type === 'select' ? (
                      <select
                        value={value}
                        onChange={e => onChange({ ...item, [f.field]: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white">
                        {(f.options ?? []).map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        value={value}
                        rows={3}
                        onChange={e => onChange({ ...item, [f.field]: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-none" />
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={e => onChange({ ...item, [f.field]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                        className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 ${f.mono ? 'font-mono' : ''}`} />
                    )}
                  </div>
                );
              })}
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              {onDelete && (
                <button onClick={() => onDelete(item.id)}
                  className="px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                  Eliminar
                </button>
              )}
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
