import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchCatalogs, saveCatalog, type CatalogKind, type CatalogOption, type CatalogPayload } from '../services/catalogs-api';

const PALETTE = ['#25A66A', '#0F9D8A', '#3B82F6', '#8B5CF6', '#EC4899', '#DC4C4C', '#E8A33D', '#9DB51F', '#737984', '#16181D'];

const FALLBACK_META: CatalogPayload['meta'] = {
  INVENTORY_STATUS: { title: 'Estados de equipo', add: 'Agregar estado', noun: ['equipo', 'equipos'] },
  INVENTORY_CAPACITY: { title: 'Capacidades', add: 'Agregar capacidad', noun: ['equipo', 'equipos'] },
  INVENTORY_CONDITION: { title: 'Condiciones', add: 'Agregar condición', noun: ['equipo', 'equipos'] },
  SALE_STATUS: { title: 'Estados de venta', add: 'Agregar estado', noun: ['venta', 'ventas'] },
  TRADE_IN_STATUS: { title: 'Estados de canje', add: 'Agregar estado', noun: ['canje', 'canjes'] },
};

type Draft = { key: string; value?: string; label: string; color: string | null; isSystem: boolean; count: number; deleted?: boolean; reassignTo?: string };

type CatalogState = {
  options: CatalogOption[];
  meta: CatalogPayload['meta'];
  canEdit: boolean;
  ready: boolean;
};

const CatalogContext = createContext<CatalogState & {
  reload: () => void;
  save: (kind: CatalogKind, options: Draft[]) => Promise<void>;
} | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { user, appSession } = useAppContext();
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [tick, setTick] = useState(0);
  const canEdit = !!appSession && appSession.membership?.role !== 'STAFF';

  useEffect(() => {
    if (!user || !appSession?.store?.id || appSession.onboardingRequired) return;
    let cancelled = false;
    fetchCatalogs(user)
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch(() => { if (!cancelled) setPayload(null); });
    return () => { cancelled = true; };
  }, [user, appSession?.store?.id, appSession?.onboardingRequired, tick]);

  const value = useMemo(() => ({
    options: payload?.options ?? [],
    meta: payload?.meta ?? FALLBACK_META,
    canEdit,
    ready: !!payload,
    reload: () => setTick((current) => current + 1),
    save: async (kind: CatalogKind, drafts: Draft[]) => {
      if (!user) return;
      const kept = drafts.filter((row) => !row.deleted);
      const deletions = drafts
        .filter((row) => row.deleted && row.value)
        .map((row) => ({ value: row.value as string, reassignTo: row.reassignTo || kept[0]?.value || kept[0]?.label || '' }));
      const next = await saveCatalog(user, kind, {
        options: kept.map((row) => ({ value: row.value, label: row.label, color: row.color })),
        deletions,
      });
      setPayload(next);
    },
  }), [payload, canEdit, user]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalogs() {
  return useContext(CatalogContext);
}

export function catalogChoices(options: CatalogOption[], kind: CatalogKind, fallback: { id: string; label: string; color?: string }[]) {
  const rows = options.filter((option) => option.kind === kind);
  if (!rows.length) return fallback;
  const mapped = rows.map((option) => ({ id: option.value, label: option.label, color: option.color ?? undefined }));
  const extra = fallback.filter((item) => !mapped.some((row) => row.id === item.id));
  return [...mapped, ...extra];
}

export function CatalogEditor({ kind, onClose }: { kind: CatalogKind; onClose: () => void }) {
  const catalogs = useCatalogs();
  const meta = catalogs?.meta[kind] ?? FALLBACK_META[kind];
  const colored = kind !== 'INVENTORY_CAPACITY' && kind !== 'INVENTORY_CONDITION';
  const source = catalogs?.options.filter((option) => option.kind === kind) ?? [];
  const [rows, setRows] = useState<Draft[]>(() => source.map((option) => ({
    key: option.id,
    value: option.value,
    label: option.label,
    color: option.color,
    isSystem: option.isSystem,
    count: option.count,
  })));
  const [openColor, setOpenColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const noun = (count: number) => (count === 1 ? meta.noun[0] : meta.noun[1]);
  const kept = rows.filter((row) => !row.deleted);

  const save = async () => {
    if (!catalogs) return;
    if (rows.some((row) => !row.deleted && !row.label.trim())) {
      setError('Completá el nombre');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await catalogs.save(kind, rows);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ov subov" onMouseDown={onClose}>
      <div className="dialog stx" role="dialog" aria-label={meta.title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="stx-h">
          <h3>{meta.title}</h3>
          <button type="button" className="stx-x" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <p>Tocá el color para cambiarlo. Si renombrás, se actualizan los registros que lo usan.</p>
        {error ? <div className="stx-err">{error}</div> : null}
        {rows.map((row) => (
          <div className={`stx-row${row.deleted ? ' del' : ''}`} key={row.key}>
            {colored ? (
              <button type="button" className={`stx-sw${openColor === row.key ? ' on' : ''}`} style={{ background: row.color ?? '#737984' }} aria-label="Color" onClick={() => setOpenColor(openColor === row.key ? null : row.key)} />
            ) : null}
            <input className="stx-in" maxLength={20} value={row.label} placeholder="Nombre" disabled={row.deleted} onChange={(event) => {
              const label = event.target.value;
              setRows((current) => current.map((item) => item.key === row.key ? { ...item, label } : item));
            }} />
            <span className="stx-n">{row.count ? `${row.count} ${noun(row.count)}` : 'nuevo'}</span>
            {row.isSystem ? <span className="stx-lock" title="Lo usa el sistema: se puede renombrar y cambiar de color, no borrar">🔒</span> : (
              <button type="button" className="stx-trash" aria-label="Borrar" onClick={() => setRows((current) => current.map((item) => item.key === row.key ? { ...item, deleted: !item.deleted, reassignTo: kept.find((candidate) => candidate.key !== row.key)?.value } : item))}>{row.deleted ? 'Deshacer' : '🗑'}</button>
            )}
            {openColor === row.key && colored ? (
              <div className="stx-pal">
                {PALETTE.map((color) => (
                  <button key={color} type="button" style={{ background: color }} aria-label={color} onClick={() => {
                    setRows((current) => current.map((item) => item.key === row.key ? { ...item, color } : item));
                    setOpenColor(null);
                  }} />
                ))}
              </div>
            ) : null}
            {row.deleted && row.count > 0 ? (
              <div className="stx-re">
                {row.count} {noun(row.count)} tienen este valor. Pasarlos a
                <select value={row.reassignTo ?? ''} onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, reassignTo: event.target.value } : item))}>
                  {kept.filter((item) => item.key !== row.key).map((item) => <option key={item.key} value={item.value || item.label}>{item.label}</option>)}
                </select>
              </div>
            ) : null}
          </div>
        ))}
        <button className="stx-add" type="button" onClick={() => setRows((current) => [...current, { key: `new-${Date.now()}`, label: '', color: colored ? PALETTE[current.length % PALETTE.length] : null, isSystem: false, count: 0 }])}>+ {meta.add}</button>
        <div className="sacts">
          <button className="btn2 s" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn2 p" type="button" onClick={() => { void save(); }} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
