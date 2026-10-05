import React, { useRef } from 'react';

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
  const skipCommitRef = useRef(false);
  const isRenaming = renamingCol === col;

  const beginRename = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    skipCommitRef.current = false;
    setRenameValue(colName);
    setRenamingCol(col);
  };

  const cancelRename = () => {
    skipCommitRef.current = true;
    setRenamingCol(null);
  };

  const commitRename = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    commitColRename(col);
  };

  return (
    <th
      ref={thRef}
      className={`relative group px-3 py-4 text-left select-none overflow-hidden ${isDragging ? 'opacity-30' : ''} ${isRenaming ? 'cursor-text' : 'cursor-grab'}`}
      style={{ width: colWidth }}
      onPointerDown={isRenaming ? undefined : onPointerDown}
      onContextMenu={onContextMenu}
    >
      {dropBefore && !isDragging && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gray-900 rounded-full z-10" />
      )}
      <span className="flex items-center gap-1.5 min-w-0 pr-5">
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            maxLength={30}
            aria-label="Nombre de la columna"
            spellCheck={false}
            className="min-w-0 flex-1 h-4 -ml-1 px-1 py-0 bg-white text-xs font-bold tracking-wider uppercase text-gray-900 leading-4 rounded-md outline-none ring-1 ring-inset ring-gray-300 focus:ring-gray-900 caret-gray-900"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitColRename(col);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <span
            className="truncate text-xs font-bold tracking-wider uppercase text-gray-400"
            onDoubleClick={beginRename}
          >
            {colName}
          </span>
        )}
        {isCustom && (
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400/70" />
        )}
      </span>
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
