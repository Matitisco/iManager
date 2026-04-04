import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Filter, Download, Printer, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, Save, Edit2, Columns, Plus, Trash2, MoreVertical, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
  const { inventory, customColumns, deleteProduct, updateProduct, inventoryCategories, createCategory, renameCategory, deleteCategory, bulkMoveCategory } = useAppContext();
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
  const [showBulkMoveConfirm, setShowBulkMoveConfirm] = useState(false);
  const [bulkMovePos, setBulkMovePos] = useState({ top: 0, left: 0 });
  const bulkMoveRef = useRef<HTMLButtonElement>(null);

  // Categories
  const [activeCategoryId, setActiveCategoryId] = useState<string | null | 'all'>('all');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const renameDoneRef = useRef(false); // prevents onBlur from re-saving after Enter or Escape

  const [inlineEditCell, setInlineEditCell] = useState<{ id: string; field: string } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  // Refs to avoid stale closures in async save handlers
  const inlineEditCellRef = useRef<{ id: string; field: string } | null>(null);
  const inlineEditValueRef = useRef('');
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showColumns, setShowColumns] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const columnsRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showColumns && columnsRef.current && !columnsRef.current.contains(e.target as Node)) setShowColumns(false);
      if (showFilters && filtersRef.current && !filtersRef.current.contains(e.target as Node)) setShowFilters(false);
      if (showSort && sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumns, showFilters, showSort]);

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

    if (activeCategoryId !== 'all') {
      const itemCat = item.categoryId ?? null;
      if (itemCat !== activeCategoryId) return false;
    }

    return true;
  });

  const sortedInventory = sortKey ? [...filteredInventory].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0;
    if (sortKey === 'model') { av = a.model.toLowerCase(); bv = b.model.toLowerCase(); }
    else if (sortKey === 'price') { av = a.price; bv = b.price; }
    else if (sortKey === 'battery') { av = extractMinBattery(a.batteryHealth); bv = extractMinBattery(b.batteryHealth); }
    else if (sortKey === 'condition') { av = a.condition; bv = b.condition; }
    const dir = sortDir === 'asc' ? 1 : -1;
    return av < bv ? -dir : av > bv ? dir : 0;
  }) : filteredInventory;

  const totalPages = Math.max(1, Math.ceil(sortedInventory.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedInventory = sortedInventory.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [filterCondition, filterGrade, filterModel, filterCapacity, filterBattery, filterStatus]);
  useEffect(() => { setSelectedIds(new Set()); }, [filterCondition, filterGrade, filterModel, filterCapacity, filterBattery, filterStatus]);

  const lastSelectedIndex = useRef<number>(-1);

  const allPageSelected = pagedInventory.length > 0 && pagedInventory.every(i => selectedIds.has(i.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); pagedInventory.forEach(i => n.delete(i.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); pagedInventory.forEach(i => n.add(i.id)); return n; });
    }
    lastSelectedIndex.current = -1;
  };

  const handleCheckboxClick = (e: React.MouseEvent, id: string, index: number) => {
    e.stopPropagation();
    if (e.shiftKey && lastSelectedIndex.current !== -1) {
      const from = Math.min(lastSelectedIndex.current, index);
      const to = Math.max(lastSelectedIndex.current, index);
      const rangeIds = pagedInventory.slice(from, to + 1).map(i => i.id);
      setSelectedIds(prev => { const n = new Set(prev); rangeIds.forEach(rid => n.add(rid)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
      lastSelectedIndex.current = index;
    }
  };

  const formatBatteryDisplay = (val: string | number) => {
    const sVal = String(val);
    const minVal = extractMinBattery(val);
    if (sVal.includes('%')) return sVal;
    if (parseFloat(sVal) < 1 && !sVal.includes('-')) return `${minVal}%`;
    return `${sVal}%`;
  };

  const startInlineEdit = (id: string, field: string, value: string) => {
    inlineEditCellRef.current = { id, field };
    inlineEditValueRef.current = value;
    setInlineEditCell({ id, field });
    setInlineEditValue(value);
  };

  const cancelInlineEdit = () => {
    inlineEditCellRef.current = null;
    setInlineEditCell(null);
  };

  const commitInlineEdit = async (invItem: Product) => {
    const cell = inlineEditCellRef.current;
    if (!cell) return; // already committed or cancelled
    const { field } = cell;
    const newVal = inlineEditValueRef.current.trim();
    inlineEditCellRef.current = null; // clear ref to prevent double-save on blur after Enter
    const currentVal = String((invItem as any)[field] ?? '');
    if (currentVal === newVal) {
      setInlineEditCell(null);
      return;
    }
    let parsed: any = newVal;
    if (field === 'price' || field === 'cost') parsed = Number(newVal) || 0;
    // Close input AFTER the API returns so the cell never briefly shows the old value:
    // when setInlineEditCell(null) fires, inventory already has the new value.
    try {
      await updateProduct({ ...invItem, [field]: parsed });
    } finally {
      setInlineEditCell(null);
    }
  };

  const handleEditableCellClick = (e: React.MouseEvent, invItem: Product, field: string, rawValue: string) => {
    e.stopPropagation();
    if (e.detail >= 2) {
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      startInlineEdit(invItem.id, field, rawValue);
    } else {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        setSelectedItem(invItem);
      }, 250);
    }
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
                  {inventoryCategories.length > 0 && (
                    <>
                      <button
                        ref={bulkMoveRef}
                        onClick={() => {
                          if (bulkMoveRef.current) {
                            const r = bulkMoveRef.current.getBoundingClientRect();
                            setBulkMovePos({ top: r.bottom + 6, left: r.left });
                          }
                          setShowBulkMoveConfirm(v => !v);
                        }}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
                      >
                        Mover a...
                      </button>
                      <AnimatePresence>
                        {showBulkMoveConfirm && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowBulkMoveConfirm(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.95 }}
                              transition={{ duration: 0.12 }}
                              style={{ top: bulkMovePos.top, left: bulkMovePos.left }}
                              className="fixed w-52 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                            >
                              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mover {selectedIds.size} equipo{selectedIds.size !== 1 ? 's' : ''} a</p>
                              </div>
                              <button onClick={async () => { await bulkMoveCategory(Array.from(selectedIds), null); setSelectedIds(new Set()); setShowBulkMoveConfirm(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-500 italic">Sin categoría</button>
                              <div className="border-t border-gray-100" />
                              {inventoryCategories.map(cat => (
                                <button key={cat.id} onClick={async () => { await bulkMoveCategory(Array.from(selectedIds), cat.id); setSelectedIds(new Set()); setShowBulkMoveConfirm(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 font-medium text-gray-700">{cat.name}</button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </>
                  )}
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
            <div className="relative" ref={columnsRef}>
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
            <button onClick={() => { setShowImportModal(true); setShowColumns(false); setShowFilters(false); setShowSort(false); }} className="px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors bg-white border-gray-200 text-gray-600 hover:bg-gray-50">
              <Upload size={16} /> <span className="hidden sm:inline">Importar</span>
            </button>
            <div className="relative" ref={sortRef}>
              <button onClick={() => { setShowSort(v => !v); setShowColumns(false); setShowFilters(false); }} className={`px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showSort || sortKey ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <ArrowUpDown size={16} /> <span className="hidden sm:inline">Ordenar</span>
              </button>
              <AnimatePresence>
                {showSort && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-gray-900 text-sm">Ordenar por</h3>
                      {sortKey && <button onClick={() => { setSortKey(null); setSortDir('asc'); }} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Limpiar</button>}
                    </div>
                    <div className="p-1.5">
                      {[
                        { key: 'model', label: 'Modelo' },
                        { key: 'price', label: 'Precio' },
                        { key: 'battery', label: 'Batería' },
                        { key: 'condition', label: 'Condición' },
                      ].map(opt => {
                        const active = sortKey === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => {
                              if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                              else { setSortKey(opt.key); setSortDir('asc'); }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                          >
                            <span className="font-medium">{opt.label}</span>
                            {active && (sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative" ref={filtersRef}>
              <button onClick={() => { setShowFilters(v => !v); setShowColumns(false); }} className={`px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showFilters ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Filter size={16} /> <span className="hidden sm:inline">Filtros</span> {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
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
                        onClick={() => { setFilterCondition('Todos'); setFilterGrade('Todos'); setFilterModel('Todos'); setFilterCapacity('Todas'); setFilterBattery('Todas'); setFilterStatus('Todos'); }}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        Limpiar
                      </button>
                    </div>
                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Modelo</label>
                        <select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none">
                          <option value="Todos">Todos</option>
                          {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Capacidad</label>
                        <select value={filterCapacity} onChange={e => setFilterCapacity(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none">
                          <option value="Todas">Todas</option>
                          {uniqueCapacities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Condición</label>
                        <select value={filterCondition} onChange={e => setFilterCondition(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none">
                          <option value="Todos">Todos</option>
                          <option value="NUEVO">NUEVO</option>
                          <option value="USADO">USADO</option>
                          <option value="PRE-OWNED">PRE-OWNED</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Disponibilidad</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none">
                          <option value="Todos">Todos</option>
                          <option value="DISPONIBLE">Disponible</option>
                          <option value="VENDIDO">Vendido</option>
                          <option value="EN_REVISION">En revisión</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grado Estético</label>
                        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none">
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
                        <select value={filterBattery} onChange={e => setFilterBattery(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none">
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

        {/* Category tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-100 overflow-x-auto">
          {(['all', ...inventoryCategories.map(c => c.id)] as const).map(catId => {
            const label = catId === 'all' ? 'Todas' : inventoryCategories.find(c => c.id === catId)?.name ?? '';
            const active = activeCategoryId === catId;
            return (
              <div key={catId} className="relative group flex-shrink-0">
                {catId !== 'all' && editingCategoryId === catId ? (
                  <input
                    autoFocus
                    value={editingCategoryName}
                    onChange={e => setEditingCategoryName(e.target.value)}
                    onBlur={async () => {
                      if (renameDoneRef.current) { renameDoneRef.current = false; return; }
                      const trimmed = editingCategoryName.trim();
                      if (trimmed && trimmed !== label) {
                        try {
                          await renameCategory(catId, trimmed);
                        } catch {
                          // revert silently on blur (input is already closing)
                        }
                      }
                      setEditingCategoryId(null);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        renameDoneRef.current = true;
                        const trimmed = editingCategoryName.trim();
                        if (trimmed && trimmed !== label) {
                          try {
                            await renameCategory(catId, trimmed);
                          } catch {
                            renameDoneRef.current = false;
                            return; // keep input open on error
                          }
                        }
                        setEditingCategoryId(null);
                      } else if (e.key === 'Escape') {
                        renameDoneRef.current = true;
                        setEditingCategoryId(null);
                      }
                    }}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 focus:outline-none focus:ring-2 focus:ring-black/10 w-28 ${active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-700'}`}
                  />
                ) : (
                  <button
                    onClick={() => setActiveCategoryId(catId)}
                    onDoubleClick={() => { if (catId !== 'all') { renameDoneRef.current = false; setEditingCategoryId(catId); setEditingCategoryName(label); } }}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    {label}
                  </button>
                )}
                {catId !== 'all' && editingCategoryId !== catId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCategoryToDelete({ id: catId, name: label }); }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 hover:bg-red-200 text-gray-500 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            );
          })}
          {/* New category */}
          {showNewCategory ? (
            <form
              onSubmit={async (e) => { e.preventDefault(); if (!newCategoryName.trim() || creatingCategory) return; setCreatingCategory(true); try { const cat = await createCategory(newCategoryName.trim()); setActiveCategoryId(cat.id); setNewCategoryName(''); setShowNewCategory(false); } finally { setCreatingCategory(false); } }}
              className="flex items-center gap-1 ml-1"
            >
              <input
                autoFocus
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && (setShowNewCategory(false), setNewCategoryName(''))}
                placeholder="Nombre..."
                className="text-sm px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 w-32"
              />
              <button type="submit" disabled={creatingCategory} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-50">OK</button>
              <button type="button" onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">✕</button>
            </form>
          ) : (
            <button onClick={() => setShowNewCategory(true)} className="flex-shrink-0 ml-1 px-2 py-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium">
              <Plus size={13} /> Nueva
            </button>
          )}
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
              {pagedInventory.map((invItem, idx) => (
                <tr key={invItem.id} onClick={() => setSelectedItem(invItem)} className="hover:bg-gray-50 cursor-pointer group">
                  <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.has(invItem.id)} onChange={() => {}} onClick={e => handleCheckboxClick(e as React.MouseEvent, invItem.id, idx)} className="w-4 h-4 rounded cursor-pointer" /></td>
                  {visibleColumns.imei !== false && (() => {
                    const isEditing = inlineEditCell?.id === invItem.id && inlineEditCell.field === 'imei';
                    return (
                      <td className={`px-6 py-4 font-mono text-gray-500 transition-colors ${isEditing ? 'bg-blue-50/40' : ''}`} title="Doble click para editar" onClick={e => handleEditableCellClick(e, invItem, 'imei', invItem.imei)}>
                        {isEditing ? (
                          <input autoFocus value={inlineEditValue}
                            onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
                            onFocus={e => e.target.select()}
                            onBlur={() => commitInlineEdit(invItem)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(invItem); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); } }}
                            onClick={e => e.stopPropagation()}
                            className="w-full bg-transparent outline-none border-0 border-b border-blue-400 pb-px font-mono text-gray-500 text-sm" />
                        ) : invItem.imei}
                      </td>
                    );
                  })()}
                  {visibleColumns.model !== false && (() => {
                    const isEditing = inlineEditCell?.id === invItem.id && inlineEditCell.field === 'model';
                    return (
                      <td className={`px-6 py-4 font-bold text-gray-900 transition-colors ${isEditing ? 'bg-blue-50/40' : ''}`} title="Doble click para editar" onClick={e => handleEditableCellClick(e, invItem, 'model', invItem.model)}>
                        {isEditing ? (
                          <input autoFocus value={inlineEditValue}
                            onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
                            onFocus={e => e.target.select()}
                            onBlur={() => commitInlineEdit(invItem)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(invItem); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); } }}
                            onClick={e => e.stopPropagation()}
                            className="w-full bg-transparent outline-none border-0 border-b border-blue-400 pb-px font-bold text-gray-900 text-sm" />
                        ) : invItem.model}
                      </td>
                    );
                  })()}
                  {visibleColumns.battery !== false && (() => {
                    const isEditing = inlineEditCell?.id === invItem.id && inlineEditCell.field === 'batteryHealth';
                    return (
                      <td className={`px-6 py-4 transition-colors ${isEditing ? 'bg-blue-50/40' : ''}`} title="Doble click para editar" onClick={e => handleEditableCellClick(e, invItem, 'batteryHealth', String(invItem.batteryHealth ?? ''))}>
                        {isEditing ? (
                          <input autoFocus value={inlineEditValue} placeholder="ej: 87%"
                            onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
                            onFocus={e => e.target.select()}
                            onBlur={() => commitInlineEdit(invItem)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(invItem); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); } }}
                            onClick={e => e.stopPropagation()}
                            className="w-24 bg-transparent outline-none border-0 border-b border-blue-400 pb-px font-bold text-sm" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${extractMinBattery(invItem.batteryHealth)}%` }} className={`h-full ${extractMinBattery(invItem.batteryHealth) >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            </div>
                            <span className={`font-bold ${extractMinBattery(invItem.batteryHealth) >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {formatBatteryDisplay(invItem.batteryHealth)}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })()}
                  {(() => {
                    const isEditing = inlineEditCell?.id === invItem.id && inlineEditCell.field === 'price';
                    return (
                      <td className={`px-6 py-4 font-bold text-gray-900 text-right transition-colors ${isEditing ? 'bg-blue-50/40' : ''}`} title="Doble click para editar" onClick={e => handleEditableCellClick(e, invItem, 'price', String(invItem.price))}>
                        {isEditing ? (
                          <input autoFocus type="number" value={inlineEditValue}
                            onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
                            onFocus={e => e.target.select()}
                            onBlur={() => commitInlineEdit(invItem)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(invItem); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); } }}
                            onClick={e => e.stopPropagation()}
                            className="w-28 bg-transparent outline-none border-0 border-b border-blue-400 pb-px font-bold text-gray-900 text-sm text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                        ) : `$${Number(invItem.price).toLocaleString('en-US')}`}
                      </td>
                    );
                  })()}
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
            <div className="flex items-center gap-1">
              <PageButton icon={<ChevronLeft size={16} />} disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)} />
              {Array.from({ length: totalPages }, (_, i) => i + 1).reduce<(number | '...')[]>((acc, page) => {
                if (page === 1 || page === totalPages || Math.abs(page - safePage) <= 1) {
                  if (acc.length && acc[acc.length - 1] !== '...' && (page as number) - (acc[acc.length - 1] as number) > 1) acc.push('...');
                  acc.push(page);
                }
                return acc;
              }, []).map((page, i) =>
                page === '...'
                  ? <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                  : <button key={page} onClick={() => setCurrentPage(page as number)} className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-medium transition-colors ${safePage === page ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>{page}</button>
              )}
              <PageButton icon={<ChevronRight size={16} />} disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)} />
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedItem && (
          <InventoryEditPanel item={selectedItem} onClose={() => setSelectedItem(null)} onDelete={(id) => { setSelectedItem(null); setItemToDelete(id); }} categories={inventoryCategories} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showImportModal && <ImportInventoryModal onClose={() => setShowImportModal(false)} />}
      </AnimatePresence>
      <ConfirmModal isOpen={!!itemToDelete} title="Eliminar" message="¿Confirmás?" onConfirm={async () => itemToDelete && await deleteProduct(itemToDelete)} onCancel={() => setItemToDelete(null)} />
      <ConfirmModal
        isOpen={!!categoryToDelete}
        title={`Eliminar categoría "${categoryToDelete?.name}"`}
        message={`¿Estás seguro? Los equipos de esta categoría quedarán sin categoría asignada.`}
        onConfirm={async () => {
          if (!categoryToDelete) return;
          if (activeCategoryId === categoryToDelete.id) setActiveCategoryId('all');
          await deleteCategory(categoryToDelete.id);
          setCategoryToDelete(null);
        }}
        onCancel={() => setCategoryToDelete(null)}
      />
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

const InventoryEditPanel = ({ item, onClose, onDelete, categories }: { item: Product, onClose: () => void, onDelete: (id: string) => void, categories: import('../types').InventoryCategory[] }) => {
  const { updateProduct, customColumns } = useAppContext();
  const [formData, setFormData] = useState<Product>(item);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setFormData(item); }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'cost' || name === 'price' ? Number(value) : value }));
  };

  const handleSave = async () => {
    const imei = formData.imei.trim();
    const model = formData.model.trim();
    if (!imei || !model) {
      setError('Completá IMEI y modelo antes de guardar.');
      return;
    }
    if (!Number.isFinite(formData.cost) || formData.cost < 0 || !Number.isFinite(formData.price) || formData.price < 0) {
      setError('Costo y precio deben ser números válidos.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateProduct({ ...formData, imei, model, categoryId: formData.categoryId || null });
      onClose();
    } catch (submitError) {
      setError(getFriendlyErrorMessage(submitError, 'No se pudo guardar el equipo.'));
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all";
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2";

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]" />
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
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Modelo</label>
              <input type="text" name="model" value={formData.model} onChange={handleChange} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>IMEI</label>
              <input type="text" name="imei" value={formData.imei} onChange={handleChange} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Capacidad</label>
              <input type="text" name="capacity" value={formData.capacity} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Color</label>
              <input type="text" name="color" value={formData.color} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Condición</label>
              <select name="condition" value={formData.condition} onChange={handleChange} className={`${inputCls} appearance-none`}>
                <option value="NUEVO">NUEVO</option>
                <option value="USADO">USADO</option>
                <option value="PRE-OWNED">PRE-OWNED</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Estética</label>
              <select name="grade" value={formData.grade} onChange={handleChange} className={`${inputCls} appearance-none`}>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Batería</label>
              <input type="text" name="batteryHealth" value={formData.batteryHealth} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Disponibilidad</label>
              <select name="status" value={formData.status} onChange={handleChange} className={`${inputCls} appearance-none`}>
                <option value="DISPONIBLE">DISPONIBLE</option>
                <option value="VENDIDO">VENDIDO</option>
                <option value="EN_REVISION">EN REVISIÓN</option>
              </select>
              {formData.status === 'VENDIDO' && item.soldAt && (
                <p className="mt-1.5 text-xs text-gray-400">Vendido el {new Date(item.soldAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Costo ($)</label>
              <input type="number" min={0} name="cost" value={formData.cost} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Precio ($)</label>
              <input type="number" min={0} name="price" value={formData.price} onChange={handleChange} className={inputCls} />
            </div>
            {categories.length > 0 && (
              <div className="col-span-2">
                <label className={labelCls}>Categoría</label>
                <select name="categoryId" value={formData.categoryId ?? ''} onChange={handleChange} className={`${inputCls} appearance-none`}>
                  <option value="">Sin categoría</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            )}
            {customColumns.map(col => (
              <div key={col.id} className="col-span-2 sm:col-span-1">
                <label className={labelCls}>{col.label}</label>
                <input
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={formData.customFields?.[col.id] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, [col.id]: col.type === 'number' ? Number(e.target.value) : e.target.value } }))}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          <button onClick={() => onDelete(item.id)} className="px-4 py-3 border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors flex items-center gap-2" disabled={isSaving}>
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors" disabled={isSaving}>
            Cancelar
          </button>
          <button onClick={handleSave} className="flex-1 px-4 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </>
  );
};
