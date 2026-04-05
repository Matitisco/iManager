import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Filter, Download, Printer, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, Save, Edit2, Columns, Plus, Trash2, MoreVertical, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { Product } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { getFriendlyErrorMessage } from '../lib/utils';
import { ImportInventoryModal } from '../components/ImportInventoryModal';
import { extractMinBattery, formatBatteryDisplay, batteryColor } from '../utils/inventory';

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


type ColId = 'imei' | 'model' | 'battery' | 'price' | 'status';
const ALL_COL_IDS: ColId[] = ['imei', 'model', 'battery', 'price', 'status'];
const ALWAYS_VISIBLE_COLS = new Set<ColId>(['price', 'status']);
const DEFAULT_COL_ORDER: ColId[] = ['imei', 'model', 'battery', 'price', 'status'];
const DEFAULT_COL_NAMES: Record<ColId, string> = { imei: 'IMEI', model: 'Modelo', battery: 'Batería', price: 'Precio', status: 'Disponibilidad' };
const DEFAULT_COL_WIDTHS: Record<ColId, number> = { imei: 180, model: 260, battery: 140, price: 120, status: 150 };
const MIN_COL_WIDTH = 40;

const EDITABLE_COL_IDS = new Set<ColId>(['imei', 'model', 'battery', 'price']);
const COL_TO_FIELD: Partial<Record<ColId, string>> = { imei: 'imei', model: 'model', battery: 'batteryHealth', price: 'price' };
const FIELD_TO_COL: Record<string, ColId> = { imei: 'imei', model: 'model', batteryHealth: 'battery', price: 'price' };

export const Inventory: React.FC = () => {
  const { inventory, customColumns, addProduct, deleteProduct, updateProduct, inventoryCategories, createCategory, renameCategory, deleteCategory, bulkMoveCategory, reorderCategories } = useAppContext();
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Product; isBulk: boolean } | null>(null);
  const [contextMoveOpen, setContextMoveOpen] = useState(false);
  const [draggingCat, setDraggingCat] = useState<{ id: string; label: string } | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [draggingItems, setDraggingItems] = useState(false);
  const [itemDragPos, setItemDragPos] = useState({ x: 0, y: 0 });
  const [itemDropTarget, setItemDropTarget] = useState<string | null>(null);
  const [pendingItemMove, setPendingItemMove] = useState<{ categoryId: string; categoryName: string; count: number } | null>(null);

  // Categories
  const [activeCategoryId, setActiveCategoryId] = useState<string | null | 'all'>('all');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const renameDoneRef = useRef(false); // prevents onBlur from re-saving after Enter or Escape
  const draggingCatRef = useRef<{ id: string; label: string } | null>(null);
  const dropTargetIdRef = useRef<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; catId: string; label: string } | null>(null);
  const catTabsContainerRef = useRef<HTMLDivElement>(null);
  const inventoryCategoriesRef = useRef(inventoryCategories);
  const reorderCategoriesRef = useRef(reorderCategories);
  const justDraggedRef = useRef(false);
  const draggingItemsRef = useRef(false);
  const itemDropTargetRef = useRef<string | null>(null);
  const itemDragStartRef = useRef<{ x: number; y: number; itemId: string } | null>(null);
  const selectedIdsRef = useRef<Set<string>>(new Set());

  const [inlineEditCell, setInlineEditCell] = useState<{ id: string; field: string } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colKey: ColId } | null>(null);
  // Refs to avoid stale closures in async save handlers
  const inlineEditCellRef = useRef<{ id: string; field: string } | null>(null);
  const inlineEditValueRef = useRef('');
  const navigatingRef = useRef(false);
  // Display override: set BEFORE setInlineEditCell(null) so the render that hides the input
  // already reads the new value — eliminates the flash of the old value.
  const committedDisplayRef = useRef<{ id: string; field: string; value: any } | null>(null);

  type AddingRow = { model: string; imei: string; price: string; batteryHealth: string; condition: Product['condition']; nameError: boolean };
  const [addingRow, setAddingRow] = useState<AddingRow | null>(null);
  // Mirror ref — always up-to-date even inside async callbacks (avoids stale closure)
  const addingRowDataRef = useRef<AddingRow | null>(null);
  const addingRowTrRef = useRef<HTMLTableRowElement | null>(null);
  const addModelInputRef = useRef<HTMLInputElement | null>(null);

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

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const s = localStorage.getItem('inventoryColWidths');
      return s ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(s) } : { ...DEFAULT_COL_WIDTHS };
    } catch { return { ...DEFAULT_COL_WIDTHS }; }
  });
  const [activeResizeCol, setActiveResizeCol] = useState<string | null>(null);
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);
  const [colOrder, setColOrder] = useState<ColId[]>(() => {
    try {
      const s = localStorage.getItem('inventoryColOrder');
      if (s) {
        const parsed: ColId[] = JSON.parse(s);
        const missing = ALL_COL_IDS.filter(c => !parsed.includes(c));
        return [...parsed, ...missing];
      }
    } catch { /* ignore */ }
    return [...DEFAULT_COL_ORDER];
  });
  const [colNames, setColNames] = useState<Record<string, string>>(() => {
    try { const s = localStorage.getItem('inventoryColNames'); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });
  const [renamingCol, setRenamingCol] = useState<ColId | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggingColId, setDraggingColId] = useState<ColId | null>(null);
  const [dropBeforeColId, setDropBeforeColId] = useState<ColId | null>(null);
  const colDragStateRef = useRef<{ id: ColId; dragging: boolean; dropBefore: ColId | null } | null>(null);
  const thRefs = useRef<Partial<Record<ColId, HTMLTableCellElement | null>>>({});
  const [colDragPos, setColDragPos] = useState({ x: 0, y: 0 });

  useEffect(() => { localStorage.setItem('inventoryColWidths', JSON.stringify(colWidths)); }, [colWidths]);
  useEffect(() => { localStorage.setItem('inventoryColOrder', JSON.stringify(colOrder)); }, [colOrder]);
  useEffect(() => { localStorage.setItem('inventoryColNames', JSON.stringify(colNames)); }, [colNames]);

  useEffect(() => {
    if (activeResizeCol) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; };
  }, [activeResizeCol]);

  useEffect(() => {
    if (draggingColId) {
      document.body.style.cursor = 'none';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; };
  }, [draggingColId]);

  useEffect(() => {
    if (draggingCat) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }
    return () => { document.body.style.cursor = ''; };
  }, [draggingCat]);

  useEffect(() => {
    if (draggingItems) {
      document.body.style.cursor = 'none';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; };
  }, [draggingItems]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showColumns && columnsRef.current && !columnsRef.current.contains(e.target as Node)) setShowColumns(false);
      if (showFilters && filtersRef.current && !filtersRef.current.contains(e.target as Node)) setShowFilters(false);
      if (showSort && sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumns, showFilters, showSort]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { inventoryCategoriesRef.current = inventoryCategories; }, [inventoryCategories]);
  useEffect(() => { reorderCategoriesRef.current = reorderCategories; }, [reorderCategories]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  const addingRowActive = !!addingRow;
  useEffect(() => { if (addingRowActive) addModelInputRef.current?.focus(); }, [addingRowActive]);

  useEffect(() => {
    const DRAG_THRESHOLD = 5;
    const onMove = (e: PointerEvent) => {
      if (pointerStartRef.current && !draggingCatRef.current) {
        const dx = e.clientX - pointerStartRef.current.x;
        const dy = e.clientY - pointerStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          const { catId, label } = pointerStartRef.current;
          draggingCatRef.current = { id: catId, label };
          setDraggingCat({ id: catId, label });
          setDragPos({ x: e.clientX, y: e.clientY });
        }
      }
      if (draggingCatRef.current) {
        setDragPos({ x: e.clientX, y: e.clientY });
        const container = catTabsContainerRef.current;
        if (container) {
          const tabEls = container.querySelectorAll<HTMLElement>('[data-cat-id]');
          let found: string | null = null;
          for (const tab of tabEls) {
            const rect = tab.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
              const id = tab.getAttribute('data-cat-id');
              if (id && id !== draggingCatRef.current.id) { found = id; break; }
            }
          }
          if (found !== dropTargetIdRef.current) {
            dropTargetIdRef.current = found;
            setDropTargetId(found);
          }
        }
      }
    };
    const onUp = () => {
      if (draggingCatRef.current) {
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 50);
        if (dropTargetIdRef.current) {
          const draggedId = draggingCatRef.current.id;
          const targetId = dropTargetIdRef.current;
          const cats = inventoryCategoriesRef.current;
          const from = cats.findIndex(c => c.id === draggedId);
          const to = cats.findIndex(c => c.id === targetId);
          if (from !== -1 && to !== -1) {
            const reordered = [...cats];
            const [moved] = reordered.splice(from, 1);
            reordered.splice(to, 0, moved);
            reorderCategoriesRef.current(reordered.map(c => c.id));
          }
        }
      }
      draggingCatRef.current = null;
      dropTargetIdRef.current = null;
      pointerStartRef.current = null;
      setDraggingCat(null);
      setDropTargetId(null);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, []);

  // Item-to-category drag (press + move to grab)
  useEffect(() => {
    const DRAG_THRESHOLD = 5;
    const onMove = (e: PointerEvent) => {
      if (itemDragStartRef.current && !draggingItemsRef.current) {
        const dx = e.clientX - itemDragStartRef.current.x;
        const dy = e.clientY - itemDragStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          // Select item if not already in selection
          if (!selectedIdsRef.current.has(itemDragStartRef.current.itemId)) {
            const newIds = new Set([itemDragStartRef.current.itemId]);
            selectedIdsRef.current = newIds;
            setSelectedIds(newIds);
          }
          draggingItemsRef.current = true;
          setDraggingItems(true);
          setItemDragPos({ x: e.clientX, y: e.clientY });
        }
      }
      if (draggingItemsRef.current) {
        setItemDragPos({ x: e.clientX, y: e.clientY });
        const container = catTabsContainerRef.current;
        if (container) {
          const tabEls = container.querySelectorAll<HTMLElement>('[data-cat-id]');
          let found: string | null = null;
          for (const tab of tabEls) {
            const rect = tab.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
              const id = tab.getAttribute('data-cat-id');
              if (id) { found = id; break; }
            }
          }
          if (found !== itemDropTargetRef.current) {
            itemDropTargetRef.current = found;
            setItemDropTarget(found);
          }
        }
      }
    };
    const onUp = () => {
      itemDragStartRef.current = null;
      if (draggingItemsRef.current) {
        if (itemDropTargetRef.current) {
          const catId = itemDropTargetRef.current;
          const catName = inventoryCategoriesRef.current.find(c => c.id === catId)?.name ?? catId;
          const count = selectedIdsRef.current.size;
          setPendingItemMove({ categoryId: catId, categoryName: catName, count });
        }
        draggingItemsRef.current = false;
        itemDropTargetRef.current = null;
        setDraggingItems(false);
        setItemDropTarget(null);
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, []);

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


  const handleContextMenu = (e: React.MouseEvent, invItem: Product) => {
    e.preventDefault();
    if (draggingItemsRef.current) return;
    const isBulk = selectedIds.has(invItem.id) && selectedIds.size > 1;
    const MENU_W = 208;
    const x = e.clientX + MENU_W > window.innerWidth ? e.clientX - MENU_W : e.clientX;
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMoveOpen(false);
    setContextMenu({ x, y, item: invItem, isBulk });
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

  const startAddRow = () => {
    if (addingRowDataRef.current) {
      addModelInputRef.current?.focus();
      return;
    }
    const initial: AddingRow = { model: '', imei: '', price: '', batteryHealth: '', condition: 'NUEVO', nameError: false };
    addingRowDataRef.current = initial;
    setAddingRow(initial);
  };

  const cancelAddRow = () => {
    addingRowDataRef.current = null;
    setAddingRow(null);
  };

  // showErrorIfEmpty=true (Enter, click-outside): muestra error si model vacío
  // showErrorIfEmpty=false (ESC): cierra sin error si model vacío; guarda si model lleno
  const commitAddRow = async (showErrorIfEmpty = true) => {
    const current = addingRowDataRef.current;
    if (!current) return;
    const model = current.model.trim();
    if (!model) {
      if (showErrorIfEmpty) {
        const withError = { ...current, nameError: true };
        addingRowDataRef.current = withError;
        setAddingRow(withError);
        addModelInputRef.current?.focus();
      } else {
        addingRowDataRef.current = null;
        setAddingRow(null);
      }
      return;
    }
    addingRowDataRef.current = null;
    setAddingRow(null);
    const imei = current.imei.trim() || `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await addProduct({
      model,
      imei,
      price: Number(current.price) || 0,
      condition: current.condition,
      batteryHealth: current.batteryHealth.trim() || 'N/A',
      capacity: '-',
      color: '-',
      grade: 'N/A',
      cost: 0,
      status: 'DISPONIBLE',
      categoryId: activeCategoryId !== 'all' ? (activeCategoryId as string) : null,
    });
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
    // Write the override ref BEFORE queuing the state update.
    // Refs are read synchronously during render, so the render triggered by
    // setInlineEditCell(null) will always see the new value — no batching required.
    committedDisplayRef.current = { id: invItem.id, field, value: parsed };
    setInlineEditCell(null);
    try {
      await updateProduct({ ...invItem, [field]: parsed });
    } finally {
      committedDisplayRef.current = null; // inventory is now up-to-date, clear override
    }
  };

  const cellDisplay = (invItem: Product, field: string, fallback: any) =>
    committedDisplayRef.current?.id === invItem.id && committedDisplayRef.current.field === field
      ? committedDisplayRef.current.value
      : fallback;

  const handleCellBlur = (invItem: Product) => {
    if (navigatingRef.current) { navigatingRef.current = false; return; }
    commitInlineEdit(invItem);
  };

  const navigateFrom = (currentId: string, currentField: string, dir: 'tab' | 'shift-tab' | 'enter' | 'down' | 'up') => {
    const currentColId = FIELD_TO_COL[currentField];
    if (!currentColId) return;
    const editableCols = orderedVisibleCols.filter(c => EDITABLE_COL_IDS.has(c));
    const rowIdx = pagedInventory.findIndex(i => i.id === currentId);
    const colIdx = editableCols.indexOf(currentColId);
    if (rowIdx === -1 || colIdx === -1) return;

    let nextRowIdx = rowIdx;
    let nextColIdx = colIdx;
    let openEdit = true;

    if (dir === 'tab') {
      nextColIdx++;
      if (nextColIdx >= editableCols.length) { nextColIdx = 0; nextRowIdx++; }
    } else if (dir === 'shift-tab') {
      nextColIdx--;
      if (nextColIdx < 0) { nextColIdx = editableCols.length - 1; nextRowIdx--; }
    } else if (dir === 'enter') {
      nextRowIdx++;
    } else if (dir === 'down') {
      nextRowIdx++;
      openEdit = false;
    } else if (dir === 'up') {
      nextRowIdx--;
      openEdit = false;
    }

    if (nextRowIdx < 0 || nextRowIdx >= pagedInventory.length) return;
    if (nextColIdx < 0 || nextColIdx >= editableCols.length) return;

    const nextItem = pagedInventory[nextRowIdx];
    const nextColId = editableCols[nextColIdx];
    const nextField = COL_TO_FIELD[nextColId];
    if (!nextField) return;
    const nextValue = String((nextItem as any)[nextField] ?? '');

    if (openEdit) {
      startInlineEdit(nextItem.id, nextField, nextValue);
    } else {
      setFocusedCell({ rowIndex: nextRowIdx, colKey: nextColId });
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, invItem: Product) => {
    const cell = inlineEditCellRef.current;
    if (!cell) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      navigatingRef.current = true;
      commitInlineEdit(invItem);
      navigateFrom(cell.id, cell.field, e.shiftKey ? 'shift-tab' : 'tab');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigatingRef.current = true;
      commitInlineEdit(invItem);
      navigateFrom(cell.id, cell.field, 'enter');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigatingRef.current = true;
      commitInlineEdit(invItem);
      navigateFrom(cell.id, cell.field, 'down');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigatingRef.current = true;
      commitInlineEdit(invItem);
      navigateFrom(cell.id, cell.field, 'up');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const rowIndex = pagedInventory.findIndex(i => i.id === cell.id);
      const colKey = FIELD_TO_COL[cell.field];
      if (rowIndex !== -1 && colKey) setFocusedCell({ rowIndex, colKey });
      cancelInlineEdit();
    }
  };

  const handleResizeStart = (e: React.PointerEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { col, startX: e.clientX, startW: colWidths[col] };
    setActiveResizeCol(col);
    const onMove = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const newW = Math.max(MIN_COL_WIDTH, resizingRef.current.startW + (ev.clientX - resizingRef.current.startX));
      setColWidths(prev => ({ ...prev, [resizingRef.current!.col]: newW }));
    };
    const onUp = () => {
      setActiveResizeCol(null);
      resizingRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleColPointerDown = (e: React.PointerEvent, col: ColId) => {
    const startX = e.clientX, startY = e.clientY;
    colDragStateRef.current = { id: col, dragging: false, dropBefore: null };
    const onMove = (ev: PointerEvent) => {
      const state = colDragStateRef.current;
      if (!state) return;
      if (!state.dragging) {
        if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
        state.dragging = true;
        setDraggingColId(col);
        setColDragPos({ x: ev.clientX, y: ev.clientY });
      }
      setColDragPos({ x: ev.clientX, y: ev.clientY });
      const sorted = ALL_COL_IDS
        .map(c => ({ c, el: thRefs.current[c] }))
        .filter(({ el }) => !!el)
        .map(({ c, el }) => ({ c, mid: el!.getBoundingClientRect().left + el!.getBoundingClientRect().width / 2 }))
        .sort((a, b) => a.mid - b.mid);
      let dropBefore: ColId | null = null;
      for (const { c, mid } of sorted) {
        if (c === col) continue;
        if (ev.clientX < mid) { dropBefore = c; break; }
      }
      state.dropBefore = dropBefore;
      setDropBeforeColId(dropBefore);
    };
    const onUp = () => {
      const state = colDragStateRef.current;
      if (state?.dragging) {
        const from = state.id, before = state.dropBefore;
        setColOrder(prev => {
          const next = prev.filter(c => c !== from);
          const idx = before !== null ? next.indexOf(before) : -1;
          next.splice(idx >= 0 ? idx : next.length, 0, from);
          return next;
        });
      }
      colDragStateRef.current = null;
      setDraggingColId(null);
      setDropBeforeColId(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const commitColRename = (col: ColId) => {
    const trimmed = renameValue.trim();
    setColNames(prev => {
      if (!trimmed || trimmed === DEFAULT_COL_NAMES[col]) {
        const next = { ...prev }; delete next[col]; return next;
      }
      return { ...prev, [col]: trimmed };
    });
    setRenamingCol(null);
  };

  const resizeHandle = (col: string) => (
    <div
      className={`absolute right-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-col-resize z-10 transition-opacity duration-150 ${activeResizeCol === col ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      onPointerDown={e => handleResizeStart(e, col)}
      onClick={e => e.stopPropagation()}
    >
      <div className={`w-2.5 h-6 rounded-[4px] transition-colors duration-150 ${activeResizeCol === col ? 'bg-gray-400' : 'bg-gray-200 hover:bg-gray-300'}`} />
    </div>
  );

  const orderedVisibleCols: ColId[] = colOrder.filter(col =>
    ALWAYS_VISIBLE_COLS.has(col) || visibleColumns[col] !== false
  );

  const renderTh = (col: ColId) => (
    <th
      key={col}
      ref={el => { thRefs.current[col] = el; }}
      className={`relative group px-3 py-4 text-left select-none cursor-grab overflow-hidden ${draggingColId === col ? 'opacity-30' : ''}`}
      style={{ width: colWidths[col] }}
      onPointerDown={e => handleColPointerDown(e, col)}
    >
      {dropBeforeColId === col && draggingColId !== col && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gray-900 rounded-full z-10" />
      )}
      {renamingCol === col ? (
        <input
          autoFocus
          value={renameValue}
          maxLength={30}
          className="text-xs font-bold tracking-wider uppercase text-gray-700 outline-none border border-gray-300 rounded-lg px-2 py-0.5 bg-white min-w-0 w-full focus:border-gray-400"
          onChange={e => setRenameValue(e.target.value)}
          onBlur={() => commitColRename(col)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitColRename(col); }
            if (e.key === 'Escape') { e.preventDefault(); setRenamingCol(null); }
          }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        />
      ) : (
        <span
          className="block truncate text-xs font-bold tracking-wider uppercase text-gray-400 pr-5"
          onDoubleClick={e => { e.stopPropagation(); setRenamingCol(col); setRenameValue(colNames[col] || DEFAULT_COL_NAMES[col]); }}
        >
          {colNames[col] || DEFAULT_COL_NAMES[col]}
        </span>
      )}
      {resizeHandle(col)}
    </th>
  );

  const renderTd = (col: ColId, invItem: Product, rowIndex: number): React.ReactNode => {
    const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell?.colKey === col;
    const focusRing = isFocused ? ' ring-1 ring-inset ring-gray-300' : '';
    switch (col) {
      case 'imei': {
        const isEditing = inlineEditCell?.id === invItem.id && inlineEditCell.field === 'imei';
        return (
          <td key={col} className={`px-3 py-4 font-mono text-gray-500 transition-colors truncate${focusRing}`} title="Doble click para editar" onDoubleClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(invItem.id, 'imei', invItem.imei); }}>
            {isEditing ? (
              <input autoFocus value={inlineEditValue} maxLength={30}
                onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
                onFocus={e => e.target.select()} onBlur={() => handleCellBlur(invItem)}
                onKeyDown={e => handleCellKeyDown(e, invItem)}
                onClick={e => e.stopPropagation()}
                className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 font-mono text-gray-500 text-sm" />
            ) : cellDisplay(invItem, 'imei', invItem.imei)}
          </td>
        );
      }
      case 'model': {
        const isEditing = inlineEditCell?.id === invItem.id && inlineEditCell.field === 'model';
        return (
          <td key={col} className={`px-3 py-4 font-bold text-gray-900 transition-colors truncate${focusRing}`} title="Doble click para editar" onDoubleClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(invItem.id, 'model', invItem.model); }}>
            {isEditing ? (
              <input autoFocus value={inlineEditValue} maxLength={30}
                onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
                onFocus={e => e.target.select()} onBlur={() => handleCellBlur(invItem)}
                onKeyDown={e => handleCellKeyDown(e, invItem)}
                onClick={e => e.stopPropagation()}
                className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 font-bold text-gray-900 text-sm" />
            ) : cellDisplay(invItem, 'model', invItem.model)}
          </td>
        );
      }
      case 'battery': {
        const isEditing = inlineEditCell?.id === invItem.id && inlineEditCell.field === 'batteryHealth';
        return (
          <td key={col} className={`px-3 py-4 transition-colors${focusRing}`} title="Doble click para editar" onDoubleClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(invItem.id, 'batteryHealth', String(invItem.batteryHealth ?? '')); }}>
            {isEditing ? (
              <input autoFocus value={inlineEditValue} placeholder="ej: 87%" maxLength={30}
                onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
                onFocus={e => e.target.select()} onBlur={() => handleCellBlur(invItem)}
                onKeyDown={e => handleCellKeyDown(e, invItem)}
                onClick={e => e.stopPropagation()}
                className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 font-bold text-sm" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${extractMinBattery(cellDisplay(invItem, 'batteryHealth', invItem.batteryHealth))}%` }} className={`h-full ${batteryColor(extractMinBattery(cellDisplay(invItem, 'batteryHealth', invItem.batteryHealth))).bg}`} />
                </div>
                <span className={`font-bold ${batteryColor(extractMinBattery(cellDisplay(invItem, 'batteryHealth', invItem.batteryHealth))).text}`}>
                  {formatBatteryDisplay(cellDisplay(invItem, 'batteryHealth', invItem.batteryHealth))}
                </span>
              </div>
            )}
          </td>
        );
      }
      case 'price': {
        const isEditing = inlineEditCell?.id === invItem.id && inlineEditCell.field === 'price';
        return (
          <td key={col} className={`px-3 py-4 font-bold text-gray-900 transition-colors${focusRing}`} title="Doble click para editar" onDoubleClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(invItem.id, 'price', String(invItem.price)); }}>
            {isEditing ? (
              <input autoFocus type="number" value={inlineEditValue}
                onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
                onFocus={e => e.target.select()} onBlur={() => handleCellBlur(invItem)}
                onKeyDown={e => handleCellKeyDown(e, invItem)}
                onClick={e => e.stopPropagation()}
                className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 font-bold text-gray-900 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            ) : `$${Number(cellDisplay(invItem, 'price', invItem.price)).toLocaleString('en-US')}`}
          </td>
        );
      }
      case 'status': {
        return (
          <td key={col} className="px-3 py-4">
            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${invItem.status === 'DISPONIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {invItem.status}
            </span>
          </td>
        );
      }
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
                      {['imei', 'model', 'condition', 'capacity', 'color', 'grade', 'battery', 'cost', 'price'].map(key => {
                        const displayName = colNames[key] || (DEFAULT_COL_NAMES as Record<string, string>)[key] || customColumns.find(c => c.id === key)?.label || key;
                        return (
                          <label key={key} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                            <input type="checkbox" checked={visibleColumns[key] !== false} onChange={() => toggleColumn(key)} className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black" />
                            <span className="text-sm font-medium text-gray-700">{displayName}</span>
                          </label>
                        );
                      })}
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
                      {([
                        { key: 'model' as ColId },
                        { key: 'price' as ColId },
                        { key: 'battery' as ColId },
                        { key: 'condition', label: 'Condición' },
                      ] as Array<{ key: string; label?: string }>).map(opt => {
                        const label = opt.label ?? (colNames[opt.key] || DEFAULT_COL_NAMES[opt.key as ColId]);
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
                            <span className="font-medium">{label}</span>
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
        <div ref={catTabsContainerRef} className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-100 overflow-x-auto select-none">
          {(['all', ...inventoryCategories.map(c => c.id)] as const).map(catId => {
            const label = catId === 'all' ? 'Todas' : inventoryCategories.find(c => c.id === catId)?.name ?? '';
            const active = activeCategoryId === catId;
            return (
              <div
                key={catId}
                data-cat-id={catId !== 'all' ? catId : undefined}
                className="relative group flex-shrink-0"
                onPointerDown={catId !== 'all' ? (e) => {
                  pointerStartRef.current = { x: e.clientX, y: e.clientY, catId, label };
                } : undefined}
              >
                {dropTargetId === catId && draggingCat?.id !== catId && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gray-900 rounded-full z-10" />
                )}
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
                    onClick={() => { if (!justDraggedRef.current) setActiveCategoryId(catId); }}
                    onDoubleClick={() => { if (catId !== 'all') { renameDoneRef.current = false; setEditingCategoryId(catId); setEditingCategoryName(label); } }}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 ${
                      draggingCat?.id === catId
                        ? 'opacity-40 border-dashed border-gray-300 text-gray-400'
                        : draggingItems && itemDropTarget === catId
                          ? 'border-gray-900 text-gray-900 bg-gray-100 scale-110 shadow-sm'
                          : draggingItems && catId !== 'all'
                            ? 'border-transparent text-gray-500 hover:text-gray-600 opacity-70'
                            : active
                              ? 'border-gray-900 text-gray-900'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
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
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-gray-50/50">
              <tr className="text-gray-400 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                <th className="px-3 py-4 w-10"><input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300" /></th>
                {orderedVisibleCols.map(col => renderTh(col))}
                <th className="px-3 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedInventory.map((invItem, idx) => (
                <tr
                  key={invItem.id}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('input, button, select')) return;
                    itemDragStartRef.current = { x: e.clientX, y: e.clientY, itemId: invItem.id };
                  }}
                  onContextMenu={e => handleContextMenu(e, invItem)}
                  className="hover:bg-gray-50 cursor-default group"
                >
                  <td className="px-3 py-4"><input type="checkbox" checked={selectedIds.has(invItem.id)} onChange={() => {}} onClick={e => handleCheckboxClick(e as React.MouseEvent, invItem.id, idx)} className="w-4 h-4 rounded cursor-pointer" /></td>
                  {orderedVisibleCols.map(col => renderTd(col, invItem, idx))}
                  <td className="px-3 py-4" onClick={e => e.stopPropagation()}><div className="opacity-0 group-hover:opacity-100"><ActionMenu onEdit={() => setSelectedItem(invItem)} onDelete={() => setItemToDelete(invItem.id)} /></div></td>
                </tr>
              ))}
              {addingRow && (
                <tr ref={addingRowTrRef} className="bg-blue-50/40 border-t-2 border-blue-200">
                  <td className="px-3 py-3" />
                  {orderedVisibleCols.map(col => {
                    if (col === 'model') return (
                      <td key={col} className="px-3 py-3">
                        <input
                          ref={addModelInputRef}
                          value={addingRow.model}
                          placeholder="Modelo..."
                          maxLength={30}
                          onChange={e => {
                            const next = { ...addingRowDataRef.current!, model: e.target.value, nameError: false };
                            addingRowDataRef.current = next;
                            setAddingRow(next);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitAddRow(); }
                            if (e.key === 'Escape') { e.preventDefault(); commitAddRow(false); }
                          }}
                          onBlur={e => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) commitAddRow(); }}
                          className={`w-full outline-none border rounded-lg px-2 py-1 font-bold text-gray-900 text-sm bg-white focus:border-gray-400 ${addingRow.nameError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                        />
                        {addingRow.nameError && <p className="text-[10px] text-red-500 mt-0.5 px-1">Requerido</p>}
                      </td>
                    );
                    if (col === 'imei') return (
                      <td key={col} className="px-3 py-3">
                        <input
                          value={addingRow.imei}
                          placeholder="IMEI (opcional)"
                          maxLength={20}
                          onChange={e => {
                            const next = { ...addingRowDataRef.current!, imei: e.target.value };
                            addingRowDataRef.current = next;
                            setAddingRow(next);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitAddRow(); }
                            if (e.key === 'Escape') { e.preventDefault(); commitAddRow(false); }
                          }}
                          onBlur={e => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) commitAddRow(); }}
                          className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 font-mono text-gray-500 text-sm bg-white focus:border-gray-400"
                        />
                      </td>
                    );
                    if (col === 'battery') return (
                      <td key={col} className="px-3 py-3">
                        <input
                          value={addingRow.batteryHealth}
                          placeholder="ej: 87%"
                          maxLength={10}
                          onChange={e => {
                            const next = { ...addingRowDataRef.current!, batteryHealth: e.target.value };
                            addingRowDataRef.current = next;
                            setAddingRow(next);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitAddRow(); }
                            if (e.key === 'Escape') { e.preventDefault(); commitAddRow(false); }
                          }}
                          onBlur={e => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) commitAddRow(); }}
                          className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:border-gray-400"
                        />
                      </td>
                    );
                    if (col === 'price') return (
                      <td key={col} className="px-3 py-3">
                        <input
                          type="number"
                          value={addingRow.price}
                          placeholder="0"
                          onChange={e => {
                            const next = { ...addingRowDataRef.current!, price: e.target.value };
                            addingRowDataRef.current = next;
                            setAddingRow(next);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitAddRow(); }
                            if (e.key === 'Escape') { e.preventDefault(); commitAddRow(false); }
                          }}
                          onBlur={e => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) commitAddRow(); }}
                          className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 font-bold text-gray-900 text-sm bg-white focus:border-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </td>
                    );
                    if (col === 'status') return (
                      <td key={col} className="px-3 py-3">
                        <select
                          value={addingRow.condition}
                          onChange={e => {
                            const next = { ...addingRowDataRef.current!, condition: e.target.value as Product['condition'] };
                            addingRowDataRef.current = next;
                            setAddingRow(next);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitAddRow(); }
                            if (e.key === 'Escape') { e.preventDefault(); commitAddRow(false); }
                          }}
                          onBlur={e => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) commitAddRow(); }}
                          className="outline-none border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 bg-white focus:border-gray-400"
                        >
                          <option value="NUEVO">NUEVO</option>
                          <option value="USADO">USADO</option>
                          <option value="PRE-OWNED">PRE-OWNED</option>
                        </select>
                      </td>
                    );
                    return <td key={col} className="px-3 py-3 text-gray-300 text-sm">–</td>;
                  })}
                  <td className="px-3 py-3">
                    <button
                      onClick={cancelAddRow}
                      className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Cancelar (descartar)"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              )}
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
                  <div className={`w-2 h-2 rounded-full ${batteryColor(extractMinBattery(invItem.batteryHealth)).bg}`} />
                  <span className={`font-bold text-xs ${batteryColor(extractMinBattery(invItem.batteryHealth)).text}`}>
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
          <span className="text-sm text-gray-500">
            {addingRow
              ? <span className="text-amber-600 font-medium text-xs">Ítem sin guardar — presioná Enter o Escape</span>
              : `Mostrando ${pagedInventory.length} de ${filteredInventory.length}`
            }
          </span>
          {totalPages > 1 && (
            <div className={`flex items-center gap-1 ${addingRow ? 'opacity-40 pointer-events-none' : ''}`}>
              <PageButton icon={<ChevronLeft size={16} />} disabled={safePage === 1 || !!addingRow} onClick={() => setCurrentPage(p => p - 1)} />
              {Array.from({ length: totalPages }, (_, i) => i + 1).reduce<(number | '...')[]>((acc, page) => {
                if (page === 1 || page === totalPages || Math.abs(page - safePage) <= 1) {
                  if (acc.length && acc[acc.length - 1] !== '...' && (page as number) - (acc[acc.length - 1] as number) > 1) acc.push('...');
                  acc.push(page);
                }
                return acc;
              }, []).map((page, i) =>
                page === '...'
                  ? <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                  : <button key={page} onClick={() => !addingRow && setCurrentPage(page as number)} className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-medium transition-colors ${safePage === page ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>{page}</button>
              )}
              <PageButton icon={<ChevronRight size={16} />} disabled={safePage === totalPages || !!addingRow} onClick={() => setCurrentPage(p => p + 1)} />
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
      <ConfirmModal
        isOpen={!!pendingItemMove}
        title={`Mover ${pendingItemMove?.count ?? 0} equipo${(pendingItemMove?.count ?? 0) !== 1 ? 's' : ''}`}
        message={`¿Mover ${pendingItemMove?.count ?? 0} equipo${(pendingItemMove?.count ?? 0) !== 1 ? 's' : ''} a "${pendingItemMove?.categoryName}"?`}
        confirmLabel="Mover"
        confirmClassName="bg-black hover:bg-gray-800"
        onConfirm={async () => {
          if (!pendingItemMove) return;
          const ids = Array.from(selectedIdsRef.current);
          const { categoryId } = pendingItemMove;
          setPendingItemMove(null);
          await bulkMoveCategory(ids, categoryId);
          setSelectedIds(new Set());
        }}
        onCancel={() => setPendingItemMove(null)}
      />

      {draggingCat && (
        <div
          style={{ position: 'fixed', left: dragPos.x - 16, top: dragPos.y - 16, pointerEvents: 'none', zIndex: 9999 }}
          className="px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-xl"
        >
          {draggingCat.label}
        </div>
      )}
      {draggingColId && (
        <div
          style={{ position: 'fixed', left: colDragPos.x - 24, top: colDragPos.y - 14, pointerEvents: 'none', zIndex: 9999 }}
          className="px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold tracking-wider uppercase rounded-full shadow-xl"
        >
          {colNames[draggingColId] || DEFAULT_COL_NAMES[draggingColId]}
        </div>
      )}
      {draggingItems && (
        <div
          style={{ position: 'fixed', left: itemDragPos.x + 14, top: itemDragPos.y - 14, pointerEvents: 'none', zIndex: 9999 }}
          className="px-3 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl shadow-xl flex items-center gap-2"
        >
          <span className="w-5 h-5 bg-white text-gray-900 text-xs font-bold rounded-full flex items-center justify-center shrink-0">{selectedIds.size}</span>
          {itemDropTarget
            ? <span>Soltar en {inventoryCategories.find(c => c.id === itemDropTarget)?.name ?? '…'}</span>
            : <span>equipo{selectedIds.size !== 1 ? 's' : ''}</span>
          }
        </div>
      )}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[70]" onMouseDown={() => setContextMenu(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.1 }}
            style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed' }}
            className="w-52 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-[80]"
          >
            {contextMenu.isBulk ? (
              <>
                <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{selectedIds.size} equipos seleccionados</p>
                </div>
                <button onClick={() => { startAddRow(); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                  <Plus size={14} /> Agregar ítem
                </button>
                <div className="border-t border-gray-100" />
                {inventoryCategories.length > 0 && (
                  <>
                    <button onClick={() => setContextMoveOpen(v => !v)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 font-medium text-gray-700 flex items-center justify-between">
                      <span>Mover a...</span>
                      <ChevronDown size={14} className={`transition-transform ${contextMoveOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {contextMoveOpen && (
                      <div className="border-t border-gray-100 bg-gray-50/30">
                        <button onClick={async () => { await bulkMoveCategory(Array.from(selectedIds), null); setSelectedIds(new Set()); setContextMenu(null); }} className="w-full text-left px-6 py-2 text-sm hover:bg-gray-100 text-gray-500 italic">Sin categoría</button>
                        {inventoryCategories.map(cat => (
                          <button key={cat.id} onClick={async () => { await bulkMoveCategory(Array.from(selectedIds), cat.id); setSelectedIds(new Set()); setContextMenu(null); }} className="w-full text-left px-6 py-2 text-sm hover:bg-gray-100 font-medium text-gray-700">{cat.name}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="border-t border-gray-100" />
                <button onClick={() => { setShowBulkDeleteConfirm(true); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center gap-2">
                  <Trash2 size={14} /> Eliminar {selectedIds.size}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { startAddRow(); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                  <Plus size={14} /> Agregar ítem
                </button>
                <div className="border-t border-gray-100" />
                <button onClick={() => { setSelectedItem(contextMenu.item); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                  <Edit2 size={14} /> Editar
                </button>
                {inventoryCategories.length > 0 && (
                  <>
                    <button onClick={() => setContextMoveOpen(v => !v)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 font-medium text-gray-700 flex items-center justify-between">
                      <span>Mover a...</span>
                      <ChevronDown size={14} className={`transition-transform ${contextMoveOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {contextMoveOpen && (
                      <div className="border-t border-gray-100 bg-gray-50/30">
                        <button onClick={async () => { await bulkMoveCategory([contextMenu.item.id], null); setContextMenu(null); }} className="w-full text-left px-6 py-2 text-sm hover:bg-gray-100 text-gray-500 italic">Sin categoría</button>
                        {inventoryCategories.map(cat => (
                          <button key={cat.id} onClick={async () => { await bulkMoveCategory([contextMenu.item.id], cat.id); setContextMenu(null); }} className="w-full text-left px-6 py-2 text-sm hover:bg-gray-100 font-medium text-gray-700">{cat.name}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="border-t border-gray-100" />
                <button onClick={() => { setItemToDelete(contextMenu.item.id); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center gap-2">
                  <Trash2 size={14} /> Eliminar
                </button>
              </>
            )}
          </motion.div>
        </>
      )}
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
