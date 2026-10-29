import type { CustomFieldInput } from '../../services/custom-fields-api';
import { fetchBackendInventory, fetchArchivedInventory } from '../../services/inventory-api';
import { useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { inventoryImportPayload } from '../../lib/inventory-import-payload';
import { IMEI_OPTIONAL_LABEL } from '../../lib/imei';
import { ImportModal, type GenericImportResult } from '../../components/ImportModal';
import { analyzeInventoryText, analyzeImport, applyImportPlan, importBackendRows, type ImportSection } from '../../services/import-api';
import { signalDesk, useDesk } from '../ui';
import { requestPriceToDefineFilter } from '../price-to-define-filter';

type ImportFlowProps = {
  kind: 'inv' | 'sale' | 'cl';
  supplierId?: string;
  supplierName?: string;
  onClose: () => void;
  onResult: (result: GenericImportResult) => void | Promise<void>;
  onImportError?: () => void;
  onStageChange?: (stage: 'file' | 'mapping' | 'review' | 'analyze') => void;
  onFilterPriceToDefine?: () => void;
};

// The onboarding and desktop adapters share every import decision and request here.
export function ImportFlow({ kind, supplierId, supplierName, onClose, onResult, onImportError, onStageChange, onFilterPriceToDefine }: ImportFlowProps) {
  const [existingImeis, setExistingImeis] = useState<string[]>([]);
  const source = useRef<'excel' | 'text'>('excel');
  const { user, customFieldDefinitions = [], customFieldDefinitionsError } = useAppContext();
  const config = useMemo(() => importConfig(kind, supplierId ? { id: supplierId, name: supplierName } : undefined), [kind, supplierId, supplierName]);
  if (!user) return null;
  const section = sectionFor(kind);
  const withExistingImeis = async <T,>(analyze: () => Promise<T>): Promise<T> => {
    if (kind !== 'inv') return analyze();
    const [analysis, active, archived] = await Promise.all([analyze(), fetchBackendInventory(user), fetchArchivedInventory(user)]);
    setExistingImeis([...active, ...archived].map(item => item.imei).filter(Boolean));
    return analysis;
  };
  return <ImportModal customFieldDefinitions={kind === 'inv' ? customFieldDefinitions : undefined} customFieldDefinitionsError={kind === 'inv' ? customFieldDefinitionsError : undefined} onFilterPriceToDefine={onFilterPriceToDefine} existingImeis={existingImeis} title={config.title} fields={config.fields} nouns={config.nouns} unrelatedNotice={config.unrelatedNotice} onClose={onClose} onStageChange={onStageChange} onAnalyzeText={kind === 'inv' ? (text) => { source.current = 'text'; return withExistingImeis(() => analyzeInventoryText(user, text)); } : undefined} onAnalyze={(sheets) => { source.current = 'excel'; return withExistingImeis(() => analyzeImport(user, section, sheets)); }} onApply={(sheets, plan, refreshMapping) => withExistingImeis(() => applyImportPlan(user, section, sheets, plan, refreshMapping))} onImport={async (rows, definitions) => {
    let result: GenericImportResult;
    try {
      result = await config.onImport(user, rows, source.current, definitions);
    } catch (cause) {
      onImportError?.();
      throw cause;
    }
    await onResult(result);
    return result;
  }} />;
}

export function ImportHost({ kind, supplierId, supplierName, onSaved }: { kind: 'inv' | 'sale' | 'cl'; supplierId?: string; supplierName?: string; onSaved?: () => void | Promise<void> }) {
  const { reloadInventory, reloadSales, reloadClients, reloadLedger, reloadCustomFieldDefinitions } = useAppContext();
  const { close, toast, go } = useDesk();
  const noun: Record<typeof kind, [string, string]> = {
    inv: ['equipo importado', 'equipos importados'],
    sale: ['venta importada', 'ventas importadas'],
    cl: ['cliente importado', 'clientes importados'],
  };
  return <ImportFlow kind={kind} supplierId={supplierId} supplierName={supplierName} onClose={close} onFilterPriceToDefine={kind === 'inv' ? () => { go('inventory'); close(); requestPriceToDefineFilter(); } : undefined} onResult={async result => {
    if (kind === 'inv') { await reloadInventory(); await reloadCustomFieldDefinitions?.(); }
    if (kind === 'sale') {
      await reloadSales();
      await reloadClients();
      await reloadInventory();
    }
    if (kind === 'cl') await reloadClients();
    if (kind === 'inv' && supplierId) await reloadLedger();
    const count = result.imported + result.updated;
    if (count > 0) {
      await onSaved?.();
      toast(`${count} ${count === 1 ? noun[kind][0] : noun[kind][1]}`);
    }
    if (kind === 'inv') signalDesk('desk-check', 'inv');
    if (kind === 'sale') signalDesk('desk-check', 'ven');
  }} />;
}

function sectionFor(kind: 'inv' | 'sale' | 'cl'): ImportSection {
  if (kind === 'inv') return 'inventory';
  if (kind === 'sale') return 'sales';
  return 'clients';
}

function importConfig(kind: 'inv' | 'sale' | 'cl', supplier?: { id: string; name?: string }) {
  if (kind === 'inv') {
    return {
      title: supplier?.name ? `Subir stock de ${supplier.name}` : 'Importar equipos',
      nouns: { one: 'equipo', many: 'equipos' },
      unrelatedNotice: 'Este archivo no parece tener equipos para importar.',
      fields: [
        { key: 'model', label: 'Modelo', required: true },
        { key: 'imei', label: IMEI_OPTIONAL_LABEL, required: false },
        { key: 'price', label: 'Precio', required: false },
        { key: 'currency', label: 'Moneda', required: false },
        { key: 'capacity', label: 'Capacidad', required: false },
        { key: 'color', label: 'Color', required: false },
        { key: 'condition', label: 'Condición', required: false },
        { key: 'grade', label: 'Calidad', required: false, hint: 'A+ / A / B / C. Solo aplica si la condición es USADO' },
        { key: 'batteryHealth', label: 'Batería', required: false },
        { key: 'supplierName', label: 'Proveedor', required: false },
        { key: 'entryDate', label: 'Fecha de ingreso', required: false },
        { key: 'batteryNote', label: 'Detalle batería', required: false },
        { key: 'cost', label: 'Costo', required: false },
        { key: 'status', label: 'Estado', required: false },
        ...(supplier ? [{ key: 'purchasedAt', label: 'Fecha de compra', required: false }, { key: 'purchaseName', label: 'Nombre de compra', required: false }] : []),
      ],
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[], source: 'excel' | 'text', definitions?: CustomFieldInput[]) => {
        const payload = inventoryImportPayload(rows);
        const result = definitions?.length
          ? await importBackendRows(user, 'inventory', payload, supplier?.id, source, definitions)
          : await importBackendRows(user, 'inventory', payload, supplier?.id, source);
        return result;
      },
    };
  }
  if (kind === 'sale') {
    return {
      title: 'Importar ventas',
      nouns: { one: 'venta', many: 'ventas' },
      unrelatedNotice: 'Este archivo no parece tener ventas para importar.',
      fields: [
        { key: 'date', label: 'Fecha', required: false },
        { key: 'clientName', label: 'Cliente', required: false },
        { key: 'clientDni', label: 'DNI del cliente', required: false },
        { key: 'clientPhone', label: 'Teléfono del cliente', required: false },
        { key: 'device', label: 'Equipo', required: false },
        { key: 'productImei', label: IMEI_OPTIONAL_LABEL, required: false },
        { key: 'amount', label: 'Precio', required: false },
        { key: 'currency', label: 'Moneda', required: false },
        { key: 'paymentMethod', label: 'Pago', required: false },
        { key: 'tradeIn', label: 'Canje', required: false },
        { key: 'seller', label: 'Vendedor', required: false },
        { key: 'status', label: 'Estado', required: false },
        { key: 'notes', label: 'Notas', required: false },
      ],
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[], source: 'excel' | 'text') => {
        const result = await importBackendRows(user, 'sales', rows, undefined, source);
        return result;
      },
    };
  }
  return {
    title: 'Importar clientes',
    nouns: { one: 'cliente', many: 'clientes' },
    unrelatedNotice: 'Este archivo no parece tener clientes para importar.',
    fields: [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'importedSpent', label: 'Histórico importado', required: false, hint: 'Compras previas a iManager. No incluir ventas importadas como comprobantes.' },
      { key: 'importedSpentCurrency', label: 'Moneda del histórico', required: false, hint: 'ARS o USD. Requerida si cargás un histórico.' },
      { key: 'phone', label: 'Teléfono', required: false },
      { key: 'instagram', label: 'Instagram', required: false },
      { key: 'email', label: 'Email', required: false },
      { key: 'dni', label: 'DNI', required: false },
    ],
    onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[], source: 'excel' | 'text') => {
      const result = await importBackendRows(user, 'clients', rows, undefined, source);
      return result;
    },
  };
}
