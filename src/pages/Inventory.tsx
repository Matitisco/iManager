import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Filter, Download, Printer, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, Save, Edit2, Columns, Plus, Trash2 } from 'lucide-react';
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
  const { inventory, customColumns } = useAppContext();
  const [showFilters, setShowFilters] = useState(false);
  const [showManageColumns, setShowManageColumns] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);
  const [filterCondition, setFilterCondition] = useState<string>('Todos');
  const [filterGrade, setFilterGrade] = useState<string>('Todos');
  const [filterModel, setFilterModel] = useState<string>('Todos');
  const [filterCapacity, setFilterCapacity] = useState<string>('Todas');
  const [filterBattery, setFilterBattery] = useState<string>('Todas');

  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('inventoryVisibleColumns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      imei: true,
      model: true,
      condition: true,
      capacityColor: true,
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

  const filteredInventory = inventory.filter(item => {
    if (filterCondition !== 'Todos' && item.condition !== filterCondition) return false;
    if (filterGrade !== 'Todos' && item.grade !== filterGrade) return false;
    if (filterModel !== 'Todos' && item.model !== filterModel) return false;
    if (filterCapacity !== 'Todas' && item.capacity !== filterCapacity) return false;
    
    if (filterBattery !== 'Todas') {
      if (filterBattery === '100' && item.batteryHealth !== 100) return false;
      if (filterBattery === '90-99' && (item.batteryHealth < 90 || item.batteryHealth > 99)) return false;
      if (filterBattery === '80-89' && (item.batteryHealth < 80 || item.batteryHealth > 89)) return false;
      if (filterBattery === '<80' && item.batteryHealth >= 80) return false;
    }
    
    return true;
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col flex-1">
      {/* Table / List View */}
      <motion.div variants={item} className="bg-white border border-gray-200 rounded-2xl flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-2xl z-10 relative">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Inventario</h2>
            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">{filteredInventory.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={() => setShowColumns(!showColumns)}
                className={`px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showColumns ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <Columns size={16} />
                <span className="hidden sm:inline">Columnas</span>
              </motion.button>

              <AnimatePresence>
                {showColumns && (
                  <motion.div
                    key="columns-panel"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900">Mostrar Columnas</h3>
                    </div>
                    <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                      {Object.entries({
                        imei: 'IMEI',
                        model: 'Modelo',
                        condition: 'Condición',
                        capacityColor: 'Capacidad / Color',
                        grade: 'Estética',
                        battery: 'Batería',
                        cost: 'Costo',
                        price: 'Precio'
                      }).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns[key] !== false}
                            onChange={() => toggleColumn(key)}
                            className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black"
                          />
                          <span className="text-sm font-medium text-gray-700">{label}</span>
                        </label>
                      ))}
                      {customColumns.map(col => (
                        <label key={col.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.id] !== false}
                            onChange={() => toggleColumn(col.id)}
                            className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black"
                          />
                          <span className="text-sm font-medium text-gray-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                      <button 
                        onClick={() => { setShowColumns(false); setShowManageColumns(true); }}
                        className="w-full py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        Administrar Columnas
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                    <button 
                      onClick={() => {
                        setFilterCondition('Todos');
                        setFilterGrade('Todos');
                        setFilterModel('Todos');
                        setFilterCapacity('Todas');
                        setFilterBattery('Todas');
                      }}
                      className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Modelo</label>
                      <select
                        value={filterModel}
                        onChange={(e) => setFilterModel(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
                      >
                        <option value="Todos">Todos</option>
                        {uniqueModels.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Capacidad</label>
                      <select
                        value={filterCapacity}
                        onChange={(e) => setFilterCapacity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
                      >
                        <option value="Todas">Todas</option>
                        {uniqueCapacities.map(cap => (
                          <option key={cap} value={cap}>{cap}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</label>
                      <select
                        value={filterCondition}
                        onChange={(e) => setFilterCondition(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
                      >
                        <option value="Todos">Todos</option>
                        <option value="NUEVO">NUEVO</option>
                        <option value="USADO">USADO</option>
                        <option value="PRE-OWNED">PRE-OWNED</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grado Estético</label>
                      <select
                        value={filterGrade}
                        onChange={(e) => setFilterGrade(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
                      >
                        <option value="Todos">Todos</option>
                        <option value="A+">A+</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="N/A">N/A</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Batería</label>
                      <select
                        value={filterBattery}
                        onChange={(e) => setFilterBattery(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
                      >
                        <option value="Todas">Todas</option>
                        <option value="100%">100%</option>
                        <option value="> 90%">Mayor a 90%</option>
                        <option value="80% - 90%">80% - 90%</option>
                        <option value="< 80%">Menor a 80%</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50">
              <tr className="text-gray-400 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                {visibleColumns.imei !== false && <th className="px-6 py-4">IMEI</th>}
                {visibleColumns.model !== false && <th className="px-6 py-4">Modelo</th>}
                {visibleColumns.condition !== false && <th className="px-6 py-4">Condición</th>}
                {visibleColumns.capacityColor !== false && <th className="px-6 py-4">Capacidad / Color</th>}
                {visibleColumns.grade !== false && <th className="px-6 py-4">Estética</th>}
                {visibleColumns.battery !== false && <th className="px-6 py-4">Batería</th>}
                {visibleColumns.cost !== false && <th className="px-6 py-4">Costo</th>}
                {visibleColumns.price !== false && <th className="px-6 py-4 text-right">Precio</th>}
                {customColumns.map(col => visibleColumns[col.id] !== false && (
                  <th key={col.id} className="px-6 py-4">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInventory.map((invItem) => (
                <tr 
                  key={invItem.id} 
                  onClick={() => setSelectedItem(invItem)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {visibleColumns.imei !== false && <td className="px-6 py-4 font-mono text-gray-500">{invItem.imei}</td>}
                  {visibleColumns.model !== false && <td className="px-6 py-4 font-bold text-gray-900">{invItem.model}</td>}
                  {visibleColumns.condition !== false && <td className="px-6 py-4">
                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${
                      invItem.condition === 'NUEVO' ? 'bg-emerald-100 text-emerald-700' :
                      invItem.condition === 'USADO' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {invItem.condition}
                    </span>
                  </td>}
                  {visibleColumns.capacityColor !== false && <td className="px-6 py-4 text-gray-500">{invItem.capacity} • {invItem.color}</td>}
                  {visibleColumns.grade !== false && <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      invItem.grade.includes('A') ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {invItem.grade}
                    </span>
                  </td>}
                  {visibleColumns.battery !== false && <td className="px-6 py-4">
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
                  </td>}
                  {visibleColumns.cost !== false && <td className="px-6 py-4 text-gray-500">${invItem.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>}
                  {visibleColumns.price !== false && <td className="px-6 py-4 font-bold text-gray-900 text-right">${invItem.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>}
                  {customColumns.map(col => visibleColumns[col.id] !== false && (
                    <td key={col.id} className="px-6 py-4 text-gray-500">
                      {invItem.customFields?.[col.id] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden flex-1 overflow-y-auto divide-y divide-gray-100">
          {filteredInventory.map((invItem) => (
            <div 
              key={invItem.id} 
              onClick={() => setSelectedItem(invItem)}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {visibleColumns.model !== false && <h3 className="font-bold text-gray-900">{invItem.model}</h3>}
                    {visibleColumns.condition !== false && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      invItem.condition === 'NUEVO' ? 'bg-emerald-100 text-emerald-700' :
                      invItem.condition === 'USADO' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {invItem.condition}
                    </span>}
                  </div>
                  {visibleColumns.capacityColor !== false && <p className="text-sm text-gray-500">{invItem.capacity} • {invItem.color}</p>}
                </div>
                <div className="text-right">
                  {visibleColumns.price !== false && <div className="font-bold text-gray-900">${invItem.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
                  {visibleColumns.cost !== false && <div className="text-xs text-gray-500">Costo: ${invItem.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs">
                {visibleColumns.imei !== false && <span className="font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">{invItem.imei.slice(-6)}</span>}
                {visibleColumns.grade !== false && <span className={`px-2 py-1 rounded font-bold ${
                  invItem.grade.includes('A') ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {invItem.grade}
                </span>}
                {visibleColumns.battery !== false && <div className="flex items-center gap-1 ml-auto">
                  <div className={`w-2 h-2 rounded-full ${invItem.batteryHealth >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className={`font-bold ${invItem.batteryHealth >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {invItem.batteryHealth}%
                  </span>
                </div>}
              </div>
              {customColumns.some(col => visibleColumns[col.id] !== false) && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                  {customColumns.map(col => visibleColumns[col.id] !== false && (
                    <div key={col.id} className="flex flex-col">
                      <span className="text-gray-400 font-medium">{col.label}</span>
                      <span className="text-gray-900 font-medium">{invItem.customFields?.[col.id] || '-'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-b-2xl">
          <span className="text-sm text-gray-500 text-center sm:text-left">Mostrando {filteredInventory.length > 0 ? 1 : 0} a {filteredInventory.length} de {inventory.length} unidades en inventario</span>
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

      <AnimatePresence>
        {showManageColumns && (
          <ManageColumnsModal onClose={() => setShowManageColumns(false)} />
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
  const { updateProduct, customColumns } = useAppContext();
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

            {customColumns.map(col => (
              <div key={col.id} className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{col.label}</label>
                <input
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={formData.customFields?.[col.id] || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    customFields: {
                      ...prev.customFields,
                      [col.id]: col.type === 'number' ? Number(e.target.value) : e.target.value
                    }
                  }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                />
              </div>
            ))}
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

const ManageColumnsModal = ({ onClose }: { onClose: () => void }) => {
  const { customColumns, addCustomColumn, removeCustomColumn } = useAppContext();
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<'text' | 'number'>('text');

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addCustomColumn({ label: newLabel, type: newType });
    setNewLabel('');
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
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white shadow-2xl z-[70] rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Administrar Columnas</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Agregar nueva columna</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre de la columna"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'text' | 'number')}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 bg-white"
              >
                <option value="text">Texto</option>
                <option value="number">Número</option>
              </select>
              <button
                onClick={handleAdd}
                disabled={!newLabel.trim()}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Columnas personalizadas</h3>
            {customColumns.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No hay columnas personalizadas.</p>
            ) : (
              <div className="space-y-2">
                {customColumns.map(col => (
                  <div key={col.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <span className="font-medium text-gray-900 text-sm">{col.label}</span>
                      <span className="ml-2 text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">{col.type === 'text' ? 'Texto' : 'Número'}</span>
                    </div>
                    <button
                      onClick={() => removeCustomColumn(col.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Eliminar columna"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};
