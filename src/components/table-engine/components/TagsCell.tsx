import React, { useRef, useState } from 'react';
import { TagField } from '../../TagField';
import { parseCellTags } from '../../../utils/cell-tags';
import type { WithId } from '../types';

interface TagsCellProps<TRow extends WithId> {
  colId: string;
  row: TRow;
  field: string;
  value: unknown;
  focusRing: string;
  onCommit: (row: TRow, field: string, tags: string[]) => void;
}

export function TagsCell<TRow extends WithId>({
  colId,
  row,
  field,
  value,
  focusRing,
  onCommit,
}: TagsCellProps<TRow>) {
  const tags = parseCellTags(value);
  const [open, setOpen] = useState(false);
  const [localTags, setLocalTags] = useState(tags);
  const tagsRef = useRef(tags);
  const draftRef = useRef('');
  const openRef = useRef(false);

  const syncTags = (next: string[]) => {
    tagsRef.current = next;
    setLocalTags(next);
  };

  const close = () => {
    if (!openRef.current) return;
    openRef.current = false;
    const next = parseCellTags([...tagsRef.current, draftRef.current]);
    draftRef.current = '';
    tagsRef.current = next;
    setOpen(false);
    onCommit(row, field, next);
  };

  return (
    <td key={colId} data-col={colId} className={`px-3 py-4${focusRing}`}>
      <div className="relative">
        <button
          type="button"
          aria-label={tags.length ? `Etiquetas: ${tags.join(', ')}` : 'Agregar etiquetas'}
          onClick={(event) => {
            event.stopPropagation();
            const current = parseCellTags(value);
            tagsRef.current = current;
            draftRef.current = '';
            openRef.current = true;
            setLocalTags(current);
            setOpen(true);
          }}
          className="flex min-h-8 max-w-full flex-wrap items-center gap-1 rounded-2xl px-2 py-1.5 -mx-2 -my-1.5 text-left hover:bg-gray-200/70"
        >
          {tags.length === 0 ? <span className="text-sm font-bold text-gray-300">---</span> : tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
              {tag}
            </span>
          ))}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={(event) => { event.stopPropagation(); close(); }} />
            <div
              className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-gray-100 bg-white p-2 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <TagField
                tags={localTags}
                onChange={syncTags}
                onDraftChange={(draft) => { draftRef.current = draft; }}
                commitDraftOnBlur={false}
                placeholder="Agregar etiqueta"
              />
              <p className="mt-2 text-[11px] text-gray-400">Enter agrega la etiqueta. Clic afuera guarda.</p>
            </div>
          </>
        )}
      </div>
    </td>
  );
}
