import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { FilterDef, SortOption } from '../types';

interface FilterPanelProps {
  filters: FilterDef[];
  activeFilters: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onReset: () => void;
}

export function FilterPanel({ filters, activeFilters, onChange, onReset }: FilterPanelProps) {
  const hasActive = filters.some(f => activeFilters[f.id] !== f.defaultValue);
  return (
    <div className="w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Filtros</h3>
        {hasActive && (
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600 font-semibold transition-colors">
            Limpiar todo
          </button>
        )}
      </div>
      {filters.map(f => (
        <div key={f.id}>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{f.label}</label>
          <select
            value={activeFilters[f.id] ?? f.defaultValue}
            onChange={e => onChange(f.id, e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white appearance-none">
            {f.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

interface SortPanelProps {
  sortOptions: SortOption[];
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: string, dir: 'asc' | 'desc') => void;
  onReset: () => void;
}

export function SortPanel({ sortOptions, sortKey, sortDir, onSort, onReset }: SortPanelProps) {
  return (
    <div className="w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2">
      {sortKey && (
        <button onClick={onReset}
          className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-600 font-semibold transition-colors rounded-lg hover:bg-gray-50">
          Sin orden
        </button>
      )}
      {sortOptions.map(opt => {
        const isActive = sortKey === opt.key;
        return (
          <div key={opt.key} className="flex">
            {(['asc', 'desc'] as const).map(dir => (
              <button key={dir}
                onClick={() => onSort(opt.key, dir)}
                className={`flex-1 text-left px-3 py-2 text-sm rounded-lg transition-colors ${isActive && sortDir === dir ? 'bg-gray-900 text-white font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                {opt.label} {dir === 'asc' ? '↑' : '↓'}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

interface ColumnsPanelProps {
  allCols: string[];
  alwaysVisible: Set<string>;
  colNames: Record<string, string>;
  defaultColNames: Record<string, string>;
  visibleColumns: Record<string, boolean>;
  onToggle: (col: string) => void;
  onResetNames: () => void;
}

export function ColumnsPanel({ allCols, alwaysVisible, colNames, defaultColNames, visibleColumns, onToggle, onResetNames }: ColumnsPanelProps) {
  return (
    <div className="w-52 bg-white rounded-xl shadow-xl border border-gray-100 p-2 max-h-80 overflow-y-auto">
      {allCols.map(col => {
        const name = colNames[col] || defaultColNames[col] || col;
        const always = alwaysVisible.has(col);
        const visible = always || visibleColumns[col] !== false;
        return (
          <label key={col} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${always ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
            <input type="checkbox" checked={visible} disabled={always} onChange={() => !always && onToggle(col)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 accent-gray-900" />
            <span className="text-sm font-medium text-gray-700 capitalize">{name}</span>
          </label>
        );
      })}
    </div>
  );
}
