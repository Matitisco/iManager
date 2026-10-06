import { useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { CREATED_TAG_LIMIT, TAG_COLORS, type ResolvedTag, type TagPatch } from '../tagOptions';

interface TagOptionMenuProps {
  options: string[];
  selected: string;
  variant: 'badge' | 'text';
  resolve: (option: string) => ResolvedTag;
  onSelect: (option: string) => void;
  onSave: (option: string, patch: TagPatch) => void;
  onCreate: (label: string, colorId?: string) => string | null;
  onDelete: (option: string) => void;
}

function TagChip({ tag, uppercase = true }: { tag: ResolvedTag; uppercase?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md font-bold tracking-wide ${uppercase ? 'uppercase' : ''} ${tag.bg} ${tag.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tag.dot}`} />
      {tag.label}
    </span>
  );
}

export function TagOptionMenu({
  options,
  selected,
  variant,
  resolve,
  onSelect,
  onSave,
  onCreate,
  onDelete,
}: TagOptionMenuProps) {
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [colorId, setColorId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const openEditor = (option: string) => {
    const tag = resolve(option);
    setCreating(false);
    setEditingOption(option);
    setDraft(tag.label);
    setColorId(tag.colorId);
    setError(null);
  };

  const openCreator = () => {
    setEditingOption(null);
    setCreating(true);
    setDraft('');
    setColorId(variant === 'badge' ? TAG_COLORS[0]?.id : undefined);
    setError(null);
  };

  const closePanel = () => {
    setEditingOption(null);
    setCreating(false);
    setError(null);
  };

  const saveEdit = () => {
    if (creating) {
      const label = draft.trim();
      if (!label) return;
      const created = onCreate(label, variant === 'badge' ? colorId : undefined);
      if (!created) {
        setError('Esa etiqueta ya existe.');
        return;
      }
      onSelect(created);
      return;
    }

    if (!editingOption) return;
    const label = draft.trim();
    if (!label) return;
    onSave(editingOption, { label, colorId: variant === 'badge' ? colorId : undefined });
    closePanel();
  };

  if (editingOption || creating) {
    const preview = editingOption ? resolve(editingOption) : undefined;
    const selectedColor = colorId ? TAG_COLORS.find((color) => color.id === colorId) : undefined;
    const fallbackColor = TAG_COLORS[0];
    const previewTag: ResolvedTag = preview
      ? {
          ...preview,
          label: draft.trim() || preview.label,
          bg: selectedColor?.bg ?? preview.bg,
          text: selectedColor?.text ?? preview.text,
          dot: selectedColor?.dot ?? preview.dot,
          colorId: selectedColor?.id ?? preview.colorId,
        }
      : {
          label: draft.trim() || 'Nueva',
          bg: selectedColor?.bg ?? fallbackColor.bg,
          text: selectedColor?.text ?? fallbackColor.text,
          dot: selectedColor?.dot ?? fallbackColor.dot,
          colorId: selectedColor?.id ?? fallbackColor.id,
        };

    return (
      <div
        className="p-3 space-y-3"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
          {creating ? 'Nueva etiqueta' : 'Editar etiqueta'}
        </p>
        <TagChip tag={previewTag} uppercase={variant === 'badge'} />
        <input
          autoFocus
          data-testid="tag-edit-input"
          maxLength={creating ? CREATED_TAG_LIMIT : 40}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              saveEdit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              closePanel();
            }
          }}
          onClick={(event) => event.stopPropagation()}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
        />
        {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
        {variant === 'badge' && (
          <div className="flex flex-wrap gap-1.5">
            {TAG_COLORS.map((color) => {
              const active = colorId === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  aria-label={`Color ${color.name}`}
                  aria-pressed={active}
                  onClick={(event) => {
                    event.stopPropagation();
                    setColorId(color.id);
                  }}
                  className={`w-5 h-5 rounded-full ${color.dot} ${active ? 'ring-2 ring-offset-2 ring-gray-900' : 'hover:scale-110'} transition-transform`}
                />
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closePanel();
            }}
            className="flex-1 py-2 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={(event) => {
              event.stopPropagation();
              saveEdit();
            }}
            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
          >
            {creating ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1" onPointerDown={(event) => event.stopPropagation()}>
      <div className="max-h-64 overflow-y-auto">
      {options.map((option) => {
        const tag = resolve(option);
        const isSelected = option === selected;
        return (
          <div key={option} className={`flex items-center gap-1 rounded-lg ${isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(option);
              }}
              className="flex-1 min-w-0 text-left px-2 py-1.5"
            >
              {variant === 'badge' ? (
                <TagChip tag={tag} />
              ) : (
                <span className={`text-sm ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{tag.label}</span>
              )}
            </button>
            <div className="mr-1 flex shrink-0 items-center">
              <button
                type="button"
                aria-label={`Editar etiqueta ${tag.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  openEditor(option);
                }}
                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-white"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                aria-label={`Eliminar etiqueta ${tag.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(option);
                }}
                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
      </div>
      <div className="mt-1 border-t border-gray-100 pt-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openCreator();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900"
        >
          <Plus size={14} />
          Nueva etiqueta
        </button>
      </div>
    </div>
  );
}

export function TagChipDisplay({ tag, withChevron = false }: { tag: ResolvedTag; withChevron?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wide ${tag.bg} ${tag.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tag.dot}`} />
      {tag.label}
      {withChevron ? <ChevronDown size={9} className="opacity-50 flex-shrink-0" /> : null}
    </span>
  );
}
