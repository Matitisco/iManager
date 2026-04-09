import React from 'react';

interface TableThProps {
  col: string;
  colName: string;
  colWidth: number;
  isDragging: boolean;
  dropBefore: boolean;
  isResizing: boolean;
  isCustom: boolean;
  renamingCol: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  setRenamingCol: (v: string | null) => void;
  commitColRename: (col: string) => void;
  thRef: (el: HTMLTableCellElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function TableTh({
  col, colName, colWidth, isDragging, dropBefore, isResizing, isCustom,
  renamingCol, renameValue, setRenameValue, setRenamingCol, commitColRename,
  thRef, onPointerDown, onResizeStart, onContextMenu,
}: TableThProps) {
  return (
    <th
      ref={thRef}
      className={`relative group px-3 py-4 text-left select-none cursor-grab overflow-hidden ${isDragging ? 'opacity-30' : ''}`}
      style={{ width: colWidth }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      {dropBefore && !isDragging && (
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
          className="flex items-center gap-1.5 min-w-0 pr-5"
          onDoubleClick={e => { e.stopPropagation(); setRenamingCol(col); }}
        >
          <span className="truncate text-xs font-bold tracking-wider uppercase text-gray-400">
            {colName}
          </span>
          {isCustom && (
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400/70" />
          )}
        </span>
      )}
      {/* Resize handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-col-resize z-10 transition-opacity duration-150 ${isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onPointerDown={onResizeStart}
        onClick={e => e.stopPropagation()}
      >
        <div className={`w-2.5 h-6 rounded-[4px] transition-colors duration-150 ${isResizing ? 'bg-gray-400' : 'bg-gray-200 hover:bg-gray-300'}`} />
      </div>
    </th>
  );
}
