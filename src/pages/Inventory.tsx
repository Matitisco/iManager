import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Filter, Download, Printer, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, Save, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const Inventory: React.FC = () => {
  const { inventory } = useAppContext();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col flex-1">
      {/* Table / List View */}
      <motion.div variants={item} className="bg-white border border-gray-200 rounded-2xl flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-2xl z-10 relative">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Inventario</h2>
            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">{inventory.length}</span>
          </div>
          <div className="relative">
            <motion.button 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }} 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showFilters ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter size={16} />
              <span className="hidden sm:inline">Filtros</span>
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </motion.button>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  key="filters-panel"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-900">Filtros</h3>
                    <button className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Limpiar</button>
                  </div>
                  <div className="p-4 space-y-4">
                    <FilterSelect label="Modelo: Todos" />
                    <FilterSelect label="Capacidad: Todas" />
                    <FilterSelect label="Estado: Todos" />
                    <FilterSelect label="Batería: Todas" />
                    <FilterSelect label="Est. Comercial: Todos" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50">
              <tr className="text-gray-400 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                <th className="px-6 py-4">IMEI</th>
                <th className="px-6 py-4">Modelo</th>
                <th className="px-6 py-4">Condición</th>
                <th className="px-6 py-4">Capacidad / Color</th>
                <th className="px-6 py-4">Estética</th>
                <th className="px-6 py-4">Batería</th>
                <th className="px-6 py-4">Costo</th>
                <th className="px-6 py-4 text-right">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventory.map((invItem) => (
                <tr 
                  key={invItem.id} 
                  onClick={() => setSelectedItem(invItem)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono text-gray-500">{invItem.imei}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{invItem.model}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${
                      invItem.condition === 'NUEVO' ? 'bg-emerald-100 text-emerald-700' :
                      invItem.condition === 'USADO' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {invItem.condition}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{invItem.capacity} • {invItem.color}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      invItem.grade.includes('A') ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {invItem.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${invItem.batteryHealth}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-full ${invItem.batteryHealth >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                        />
                      </div>
                      <span className={`font-bold ${invItem.batteryHealth >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {invItem.batteryHealth}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">${invItem.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 text-right">${invItem.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden flex-1 overflow-y-auto divide-y divide-gray-100">
          {inventory.map((invItem) => (
            <div 
              key={invItem.id} 
              onClick={() => setSelectedItem(invItem)}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{invItem.model}</h3>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      invItem.condition === 'NUEVO' ? 'bg-emerald-100 text-emerald-700' :
                      invItem.condition === 'USADO' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {invItem.condition}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{invItem.capacity} • {invItem.color}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">${invItem.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs text-gray-500">Costo: ${invItem.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs">
                <span className="font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">{invItem.imei.slice(-6)}</span>
                <span className={`px-2 py-1 rounded font-bold ${
                  invItem.grade.includes('A') ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {invItem.grade}
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <div className={`w-2 h-2 rounded-full ${invItem.batteryHealth >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className={`font-bold ${invItem.batteryHealth >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {invItem.batteryHealth}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-b-2xl">
          <span className="text-sm text-gray-500 text-center sm:text-left">Mostrando 1 a {inventory.length} de 124 unidades en inventario</span>
          <div className="flex flex-wrap items-center justify-center gap-1">
            <PageButton icon={<ChevronLeft size={16} />} />
            <PageButton label="1" active />
            <PageButton label="2" />
            <PageButton label="3" />
            <span className="px-2 text-gray-400">...</span>
            <PageButton label="12" />
            <PageButton icon={<ChevronRight size={16} />} />
          </div>
        </div>
      </motion.div>

      {/* Footer Stats */}
      <motion.div variants={item} className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-wrap gap-6 md:gap-12">
          <div>
            <div className="text-xs font-bold text-gray-400 tracking-wider mb-1">VALOR INVENTARIO</div>
            <div className="text-lg font-black text-gray-900">$114,240.00 USD</div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 tracking-wider mb-1">MARGEN PROMEDIO</div>
            <div className="text-lg font-black text-emerald-600">22.4%</div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 tracking-wider mb-1">UNIDADES DISPONIBLES</div>
            <div className="text-lg font-black text-gray-900">86 / 124</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 md:flex-none justify-center flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <Download size={18} /> Exportar
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 md:flex-none justify-center flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <Printer size={18} /> Etiquetas
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedItem && (
          <InventoryEditPanel 
            item={selectedItem} 
            onClose={() => setSelectedItem(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FilterSelect = ({ label }: { label: string }) => {
  const [key, value] = label.split(': ');
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{key}</label>
      <button className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center justify-between transition-colors">
        <span className="text-gray-500">{value}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
    </div>
  );
};

const PageButton = ({ label, icon, active }: { label?: string, icon?: React.ReactNode, active?: boolean }) => (
  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
    active ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
  }`}>
    {label || icon}
  </motion.button>
);

const InventoryEditPanel = ({ item, onClose }: { item: Product, onClose: () => void }) => {
  const { updateProduct } = useAppContext();
  const [formData, setFormData] = useState<Product>(item);

  // Sync state if item changes
  useEffect(() => {
    setFormData(item);
  }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'cost' || name === 'price' || name === 'batteryHealth' ? Number(value) : value
    }));
  };

  const handleSave = () => {
    updateProduct(formData);
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col border-l border-gray-200"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <Edit2 size={18} className="text-gray-900" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Editar Producto</h2>
              <p className="text-xs text-gray-500 font-mono">{item.imei}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Modelo</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">IMEI</label>
              <input
                type="text"
                name="imei"
                value={formData.imei}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Capacidad</label>
              <input
                type="text"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Color</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Condición</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all appearance-none"
              >
                <option value="NUEVO">NUEVO</option>
                <option value="USADO">USADO</option>
                <option value="PRE-OWNED">PRE-OWNED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Estética</label>
              <select
                name="grade"
                value={formData.grade}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all appearance-none"
              >
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="N/A">N/A</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Batería (%)</label>
              <input
                type="number"
                name="batteryHealth"
                value={formData.batteryHealth}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Estado</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all appearance-none"
              >
                <option value="DISPONIBLE">DISPONIBLE</option>
                <option value="VENDIDO">VENDIDO</option>
                <option value="EN_REVISION">EN REVISIÓN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Costo ($)</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Precio ($)</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
          >
            <Save size={18} />
            Guardar
          </button>
        </div>
      </motion.div>
    </>
  );
};
