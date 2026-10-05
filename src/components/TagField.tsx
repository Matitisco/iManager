import React, { useState } from 'react';
import { parseCellTags, sameCellTags } from '../utils/cell-tags';

interface TagFieldProps {
  id?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  onDraftChange?: (draft: string) => void;
  commitDraftOnBlur?: boolean;
  placeholder?: string;
}

export function TagField({
  id,
  tags,
  onChange,
  onDraftChange,
  commitDraftOnBlur = true,
  placeholder = 'Agregar etiqueta',
}: TagFieldProps) {
  const [draft, setDraft] = useState('');

  const updateDraft = (value: string) => {
    setDraft(value);
    onDraftChange?.(value);
  };

  const commitDraft = () => {
    const next = parseCellTags([...tags, draft]);
    updateDraft('');
    if (!sameCellTags(next, tags)) onChange(next);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
          {tag}
          <button
            type="button"
            aria-label={`Quitar ${tag}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
            className="text-gray-500 hover:text-gray-900"
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label="Nueva etiqueta"
        value={draft}
        placeholder={tags.length === 0 ? placeholder : ''}
        onChange={(event) => {
          const value = event.target.value;
          if (value.includes(',')) {
            const next = parseCellTags([...tags, ...value.split(',')]);
            updateDraft('');
            if (!sameCellTags(next, tags)) onChange(next);
            return;
          }
          updateDraft(value);
        }}
        onBlur={() => {
          if (commitDraftOnBlur) commitDraft();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            event.stopPropagation();
            commitDraft();
          } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
            event.preventDefault();
            onChange(tags.slice(0, -1));
          }
        }}
        className="min-w-[7rem] flex-1 bg-transparent py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
