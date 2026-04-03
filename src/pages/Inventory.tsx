import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Filter, Download, Printer, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, Save, Edit2, Columns, Plus, Trash2, MoreVertical, Upload } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { Product } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { getFriendlyErrorMessage } from '../lib/utils';
import { ImportInventoryModal } from '../components/ImportInventoryModal';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const Inventory: React.FC = () => {
  const { inventory, customColumns, deleteProduct, updateProduct } = useAppContext();
  const [showFilters, setShowFilters] = useState(false);
  const [showManageColumns, setShowManageColumns] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [filterCondition, setFilterCondition] = useState<string>('Todos');
  const [filterGrade, setFilterGrade] = useState<string>('Todos');
  const [filterModel, setFilterModel] = useState<string>('Todos');
  const [filterCapacity, setFilterCapacity] = useState<string>('Todas');
  const [filterBattery, setFilterBattery] = useState<string>('Todas');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('inventoryVisibleColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if ('capacityColor' in parsed) {
          const { capacityColor, ...rest } = parsed;
          return { ...rest, capacity: capacityColor, color: capacityColor };
        }
        return parsed;
      } catch (e) {
        // ignore
      }
    }
    return {
      imei: true,
      model: true,
      condition: true,
      capacity: true,
      color: true,
      grade: true,
      battery: true,
      cost: true,
      price: true
    };
  });

  useEffect(() => {
    localStorage.setItem('inventoryVisibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const uniqueModels = Array.from(new Set(inventory.map(item => item.model))).sort();
  const uniqueCapacities = Array.from(new Set(inventory.map(item => item.capacity))).sort();

  const extractMinBattery = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 100;
    const sVal = String(val).trim();
    const numVal = parseFloat(sVal);
    if (!isNaN(numVal) && numVal > 0 && numVal < 1 && !sVal.includes('-')) {
      return Math.round(numVal * 100);
    }
    const match = sVal.match(/\d+/);
    return match ? parseInt(match[0], 10) : 100;
  };

  const filteredInventory = inventory.filter(item => {
    if (filterCondition !== 'Todos' && item.condition !== filterCondition) return false;
    if (filterGrade !== 'Todos' && item.grade !== filterGrade) return false;
    if (filterModel !== 'Todos' && item.model !== filterModel) return false;
    if (filterCapacity !== 'Todas' && item.capacity !== filterCapacity) return false;
    if (filterStatus !== 'Todos' && item.status !== filterStatus) return false;

    if (filterBattery !== 'Todas') {
      const minBat = extractMinBattery(item.batteryHealth);
      if (filterBattery === '100%' && minBat !== 100) return false;
      if (filterBattery === '> 90%' && minBat <= 90) return false;
      if (filterBattery === '80% - 90%' && (minBat < 80 || minBat > 90)) return false;
      if (filterBattery === '< 80%' && minBat >= 80) return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedInventory = filteredInventory.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [filterCondition, filterGrade, filterModel, filterCapacity, filterBattery, filterStatus]);
  useEffect(() => { setSelectedIds(new Set()); }, [filterCondition, filterGrade, filterModel, filterCapacity, filterBattery, filterStatus]);

  const allPageSelected = pagedInventory.length > 0 && pagedInventory.every(i => selectedIds.has(i.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); pagedInventory.forEach(i => n.delete(i.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); pagedInventory.forEach(i => n.add(i.id)); return n; });
    }
  };
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const formatBatteryDisplay = (val: string | number) => {
    const sVal = String(val);
    const minVal = extractMinBattery(val);
    if (sVal.includes('%')) return sVal;
    if (parseFloat(sVal) < 1 && !sVal.includes('-')) return `${minVal}%`;
    return `${sVal}%`;
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col flex-1">
      <motion.div variants={item} className="bg-white border border-gray-200 rounded-2xl flex-1 flex flex-col">
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-t-2xl"
            >
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-red-700">
                  {selectedIds.size} equipo{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Cancelar</button>
                  <button onClick={() => setShowBulkDeleteConfirm(true)} className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 hover:bg-red-700 transition-colors">
                    <Trash2 size={14} /> Eliminar {selectedIds.size}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-2xl z-10 relative">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Inventario</h2>
            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">{filteredInventory.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => { setShowColumns(v => !v); setShowFilters(false); }} className={`px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showColumns ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Columns size={16} /> <span className="hidden sm:inline">Columnas</span>
              </button>
              <AnimatePresence>
                {showColumns && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50"><h3 className="font-bold text-gray-900">Mostrar Columnas</h3></div>
                    <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                      {['imei', 'model', 'condition', 'capacity', 'color', 'grade', 'battery', 'cost', 'price'].map(key => (
                        <label key={key} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <input type="checkbox" checked={visibleColumns[key] !== false} onChange={() => toggleColumn(key)} className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black" />
                          <span className="text-sm font-medium text-gray-700 uppercase">{key}</span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => { setShowImportModal(true); setShowColumns(false); setShowFilters(false); }} className="px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors bg-white border-gray-200 text-gray-600 hover:bg-gray-50">
              <Upload size={16} /> <span className="hidden sm:inline">Importar</span>
            </button>
            <div className="relative">
              <button onClick={() => { setShowFilters(v => !v); setShowColumns(false); }} className={`px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showFilters ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Filter size={16} /> <span className="hidden sm:inline">Filtros</span> {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <AnimatePresence>
                {showFilters && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"><h3 className="font-bold text-gray-900">Filtros</h3><button onClick={() => { setFilterCondition('Todos'); setFilterGrade('Todos'); setFilterModel('Todos'); setFilterCapacity('Todas'); setFilterBattery('Todas'); setFilterStatus('Todos'); }} className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Limpiar</button></div>
                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto text-sm">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Modelo</label><select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="w-full px-3 py-2 border rounded-lg appearance-none"><option>Todos</option>{uniqueModels.map(m => <option key={m}>{m}</option>)}</select></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Batería</label><select value={filterBattery} onChange={e => setFilterBattery(e.target.value)} className="w-full px-3 py-2 border rounded-lg appearance-none"><option>Todas</option><option>100%</option><option>{'>'} 90%</option><option>80% - 90%</option><option>{'<'} 80%</option></select></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50">
              <tr className="text-gray-400 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                <th className="px-4 py-4 w-10"><input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300" /></th>
                {visibleColumns.imei !== false && <th className="px-6 py-4">IMEI</th>}
                {visibleColumns.model !== false && <th className="px-6 py-4">Modelo</th>}
                {visibleColumns.battery !== false && <th className="px-6 py-4">Batería</th>}
                <th className="px-6 py-4 text-right">Precio</th>
                <th className="px-6 py-4">Disponibilidad</th>
                <th className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedInventory.map(invItem => (
                <tr key={invItem.id} onClick={() => setSelectedItem(invItem)} className="hover:bg-gray-50 cursor-pointer group">
                  <td className="px-4 py-4" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(invItem.id)} onChange={() => toggleSelect(invItem.id)} className="w-4 h-4 rounded" /></td>
                  {visibleColumns.imei !== false && <td className="px-6 py-4 font-mono text-gray-500">{invItem.imei}</td>}
                  {visibleColumns.model !== false && <td className="px-6 py-4 font-bold text-gray-900">{invItem.model}</td>}
                  {visibleColumns.battery !== false && <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${extractMinBattery(invItem.batteryHealth)}%` }} className={`h-full ${extractMinBattery(invItem.batteryHealth) >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      </div>
                      <span className={`font-bold ${extractMinBattery(invItem.batteryHealth) >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {formatBatteryDisplay(invItem.batteryHealth)}
                      </span>
                    </div>
                  </td>}
                  <td className="px-6 py-4 font-bold text-gray-900 text-right">${Number(invItem.price).toLocaleString('en-US')}</td>
                  <td className="px-6 py-4"><span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${invItem.status === 'DISPONIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{invItem.status}</span></td>
                  <td className="px-6 py-4" onClick={e => e.stopPropagation()}><div className="opacity-0 group-hover:opacity-100"><ActionMenu onEdit={() => setSelectedItem(invItem)} onDelete={() => setItemToDelete(invItem.id)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex-1 overflow-y-auto divide-y divide-gray-100">
          {pagedInventory.map(invItem => (
            <div key={invItem.id} onClick={() => setSelectedItem(invItem)} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{invItem.model}</h3>
                  <span className="text-[10px] text-gray-400 font-mono">{invItem.imei.slice(-6)}</span>
                </div>
                <div className="font-bold text-gray-900">${Number(invItem.price).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${extractMinBattery(invItem.batteryHealth) >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className={`font-bold text-xs ${extractMinBattery(invItem.batteryHealth) >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatBatteryDisplay(invItem.batteryHealth)}
                  </span>
                </div>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-700 uppercase">{invItem.status}</span>
                <ActionMenu onEdit={() => setSelectedItem(invItem)} onDelete={() => setItemToDelete(invItem.id)} />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">Mostrando {pagedInventory.length} de {filteredInventory.length}</span>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <PageButton icon={<ChevronLeft size={16} />} disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)} />
              <PageButton icon={<ChevronRight size={16} />} disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)} />
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedItem && (
          <InventoryEditPanel item={selectedItem} onClose={() => setSelectedItem(null)} onDelete={(id) => { setSelectedItem(null); setItemToDelete(id); }} />
        )}
      </AnimatePresence>
      {showImportModal && <ImportInventoryModal onClose={() => setShowImportModal(false)} />}
      <ConfirmModal isOpen={!!itemToDelete} title="Eliminar" message="¿Confirmás?" onConfirm={async () => itemToDelete && await deleteProduct(itemToDelete)} onCancel={() => setItemToDelete(null)} />
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        title={`Eliminar ${selectedIds.size} equipo${selectedIds.size !== 1 ? 's' : ''}`}
        message={`¿Estás seguro de que querés eliminar ${selectedIds.size} equipo${selectedIds.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          for (const id of Array.from(selectedIds)) {
            await deleteProduct(id);
          }
          setSelectedIds(new Set());
          setShowBulkDeleteConfirm(false);
        }}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
    </motion.div>
  );
};

const ActionMenu = ({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={e => { e.stopPropagation(); setIsOpen(!isOpen); }} className="p-1 text-gray-400 hover:text-gray-900"><MoreVertical size={16} /></button>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border z-50 overflow-hidden text-sm">
              <button onClick={onEdit} className="w-full text-left px-4 py-2 hover:bg-gray-50">Editar</button>
              <button onClick={onDelete} className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50">Eliminar</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const PageButton = ({ icon, disabled, onClick }: { icon: React.ReactNode, disabled?: boolean, onClick?: () => void }) => (
  <button onClick={onClick} disabled={disabled} className={`w-8 h-8 flex items-center justify-center rounded border ${disabled ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-50'}`}>{icon}</button>
);

const InventoryEditPanel = ({ item, onClose, onDelete }: { item: Product, onClose: () => void, onDelete: (id: string) => void }) => {
  const { updateProduct } = useAppContext();
  const [formData, setFormData] = useState<Product>(item);
  const handleSave = async () => {
    await updateProduct(formData);
    onClose();
  };
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold">Editar {item.model}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="flex-1 space-y-4">
          <div><label className="block text-xs font-bold text-gray-500 mb-1">Modelo</label><input type="text" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">Batería</label><input type="text" value={formData.batteryHealth} onChange={e => setFormData({...formData, batteryHealth: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">Precio</label><input type="number" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
        </div>
        <div className="flex gap-3 pt-6 border-t mt-auto">
          <button onClick={() => onDelete(item.id)} className="p-3 border rounded-xl text-red-600"><Trash2 size={18} /></button>
          <button onClick={handleSave} className="flex-1 bg-black text-white py-3 rounded-xl font-bold">Guardar</button>
        </div>
      </motion.div>
    </>
  );
};
