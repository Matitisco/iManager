import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchCatalogs, saveCatalog, type CatalogKind, type CatalogOption, type CatalogPayload } from '../services/catalogs-api';

const PALETTE = [
  ['#25A66A', 'Verde'], ['#0F9D8A', 'Turquesa'], ['#3B82F6', 'Azul'],
  ['#8B5CF6', 'Violeta'], ['#EC4899', 'Rosa'], ['#DC4C4C', 'Rojo'],
  ['#E8A33D', 'Ámbar'], ['#FFD000', 'Amarillo'], ['#737984', 'Gris'], ['#16181D', 'Carbón'],
] as const;

const FALLBACK_META: CatalogPayload['meta'] = {
  INVENTORY_STATUS: { title: 'Estados de equipo', add: 'Agregar estado', noun: ['equipo', 'equipos'] },
  INVENTORY_CAPACITY: { title: 'Capacidades', add: 'Agregar capacidad', noun: ['equipo', 'equipos'] },
  INVENTORY_CONDITION: { title: 'Condiciones', add: 'Agregar condición', noun: ['equipo', 'equipos'] },
  SALE_STATUS: { title: 'Estados de venta', add: 'Agregar estado', noun: ['venta', 'ventas'] },
  TRADE_IN_STATUS: { title: 'Estados de canje', add: 'Agregar estado', noun: ['canje', 'canjes'] },
  CLIENT_TAG: { title: 'Etiquetas de cliente', add: 'Agregar etiqueta', noun: ['cliente', 'clientes'] },
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
  const [badRow, setBadRow] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const focusAdded = useRef(false);

  useEffect(() => {
    if (!focusAdded.current) return;
    const inputs = listRef.current?.querySelectorAll<HTMLInputElement>('.stx-in');
    inputs?.[inputs.length - 1]?.focus();
    focusAdded.current = false;
  }, [rows.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!busy) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [busy, onClose]);

  const noun = (count: number) => (count === 1 ? meta.noun[0] : meta.noun[1]);
  const kept = rows.filter((row) => !row.deleted);
  const thing = kind === 'CLIENT_TAG' ? 'esta etiqueta'
    : kind === 'INVENTORY_CAPACITY' ? 'esta capacidad'
      : kind === 'INVENTORY_CONDITION' ? 'esta condición' : 'este estado';
  const targets = kept.filter((row) => row.label.trim());
  const targetFor = (row: Draft) => targets.find((target) => (target.value || target.label.trim()) === row.reassignTo)
    ?? targets[0];
  const close = () => { if (!busy) onClose(); };

  const save = async () => {
    if (!catalogs) return;
    setError(null);
    setBadRow(null);
    if (!kept.length) {
      setError('Tiene que quedar al menos uno.');
      return;
    }
    const seen = new Set<string>();
    for (const row of kept) {
      const label = row.label.trim();
      if (!label || seen.has(label.toLowerCase())) {
        setBadRow(row.key);
        setError(label ? `«${label}» está repetido.` : 'Hay uno sin nombre.');
        return;
      }
      seen.add(label.toLowerCase());
    }
    setBusy(true);
    try {
      await catalogs.save(kind, rows.map((row) => {
        const target = row.deleted ? targetFor(row) : undefined;
        return { ...row, label: row.label.trim(), reassignTo: target ? (target.value || target.label.trim()) : undefined };
      }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ov center subov" onMouseDown={close}>
      <div className={`dialog stx${colored ? '' : ' nc'}`} role="dialog" aria-modal="true" aria-label={meta.title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="stx-h">
          <h3>{meta.title}</h3>
          <button type="button" className="stx-x" aria-label="Cerrar" disabled={busy} onClick={close}>×</button>
        </div>
        <p className="stx-sub">{colored ? 'Tocá el color para cambiarlo. ' : ''}Si renombrás, se actualizan los {meta.noun[1]} que {thing.startsWith('esta') ? 'la' : 'lo'} usan.</p>
        <div className="stx-list" ref={listRef}>
          {rows.map((row) => (
            <React.Fragment key={row.key}>
              <div className={`stx-row${row.deleted ? ' del' : ''}${badRow === row.key ? ' bad' : ''}`}>
                {colored ? (
                  <button type="button" className={`stx-sw${openColor === row.key ? ' open' : ''}`} style={{ background: row.color ?? '#737984' }} title="Elegir color" aria-label="Elegir color" disabled={row.deleted || busy} onClick={() => setOpenColor(openColor === row.key ? null : row.key)} />
                ) : null}
                <input className="stx-in" aria-label={`Nombre de ${thing} ${row.label || 'nuevo'}`} maxLength={20} value={row.label} placeholder="Nombre" disabled={row.deleted || busy} onChange={(event) => {
                  const label = event.target.value;
                  setRows((current) => current.map((item) => item.key === row.key ? { ...item, label } : item));
                }} />
                <span className="stx-cnt">{row.value ? `${row.count} ${noun(row.count)}` : 'nuevo'}</span>
                {row.isSystem ? <span className="stx-lock" title="Lo usa el sistema: se puede renombrar y cambiar de color, no borrar">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                </span> : (
                  <button type="button" className={row.deleted ? 'stx-undo' : 'stx-del'} title={row.deleted ? undefined : 'Eliminar'} aria-label={row.deleted ? 'Deshacer' : 'Eliminar'} disabled={busy} onClick={() => {
                    if (openColor === row.key) setOpenColor(null);
                    const fallback = kept.find((candidate) => candidate.key !== row.key);
                    setRows((current) => current.map((item) => item.key === row.key ? { ...item, deleted: !item.deleted, reassignTo: !item.deleted && fallback ? (fallback.value || fallback.label) : undefined } : item));
                  }}>{row.deleted ? 'Deshacer' : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>}</button>
                )}
              </div>
              {openColor === row.key && colored && !row.deleted ? (
                <div className="stx-pal">
                  {PALETTE.map(([color, label]) => (
                    <button key={color} type="button" className={row.color === color ? 'on' : ''} style={{ background: color }} title={label} aria-label={label} aria-pressed={row.color === color} disabled={busy} onClick={() => {
                      setRows((current) => current.map((item) => item.key === row.key ? { ...item, color } : item));
                      setOpenColor(null);
                    }} />
                  ))}
                </div>
              ) : null}
              {row.deleted && row.count > 0 ? (
                <div className="stx-re">
                  {row.count} {noun(row.count)} {row.count === 1 ? 'tiene' : 'tienen'} {thing}. Pasarlos a
                  <select aria-label={`Pasar ${noun(row.count)} de ${row.label} a`} disabled={busy} value={targetFor(row)?.value || targetFor(row)?.label.trim() || ''} onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, reassignTo: event.target.value } : item))}>
                    {targets.map((item) => <option key={item.key} value={item.value || item.label.trim()}>{item.label}</option>)}
                  </select>
                </div>
              ) : row.deleted ? <div className="stx-re soft">Se elimina al guardar.</div> : null}
            </React.Fragment>
          ))}
        </div>
        <button className="stx-add" type="button" disabled={busy} onClick={() => {
          const color = (PALETTE.find(([value]) => !rows.some((row) => row.color === value)) ?? PALETTE[8])[0];
          focusAdded.current = true;
          setOpenColor(null);
          setRows((current) => [...current, { key: `new-${crypto.randomUUID()}`, label: '', color: colored ? color : null, isSystem: false, count: 0 }]);
        }}>+ {meta.add}</button>
        {error ? <div className="stx-err" role="alert">{error}</div> : null}
        <div className="row">
          <button className="cancel" type="button" onClick={close} disabled={busy}>Cancelar</button>
          <button className="ok" type="button" onClick={() => { void save(); }} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
