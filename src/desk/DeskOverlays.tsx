import { StockOnboarding } from '../pages/StockOnboarding';
import { DepositForm, RepairDepositSheet } from './overlays/deposits';
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { getFriendlyErrorMessage } from '../lib/utils';
import { archivedMatchOf } from '../services/api-client';
import { restoreBackendClient } from '../services/clients-api';
import { restoreBackendInventoryItem } from '../services/inventory-api';
import { isActiveTradeOperation } from './format';
import { RepairOrderDetail, RepairOrderEditor, RepairOrderForm } from './RepairForms';
import { usePhoneLayout } from './section-notices';
import { DeskIcon, Dialog, Sheet, useDesk, useEscape, Actions } from './ui';
import type { Overlay } from './types';
import { markSessionClosed } from './screens/SessionClosed';
import { EquipmentDetail, EquipmentForm } from './overlays/equipment';
import { BatchLoad } from './overlays/batch-load';
import { ScanReviewHost } from './overlays/scan-review';
import { SaleForm, SaleDetail } from './overlays/operation';
import { TradeForm, TradeDetail } from './overlays/trade';
import { ClientDetail, ClientForm } from './overlays/client';
import { StoreForm, ContactForm, ProfileForm, PasswordForm, InviteForm, InvitesList, WarrantyForm } from './overlays/account';
import { PeriodicReportForm } from './overlays/periodic-report';
import { ImportHost } from './overlays/import';
import { ExpenseForm } from './overlays/expense';
import { ReturnDetail, ReturnForm } from './overlays/return-case';
import { SupplierDetail, SupplierForm } from './overlays/supplier';

export function DeskOverlays({ overlay, onSaved }: { overlay: Overlay | null; onSaved?: () => void }) {
  if (!overlay) return null;
  if (overlay.type === 'ctx') return <ContextMenu overlay={overlay} />;
  if (overlay.type === 'import') return <ImportHost kind={overlay.kind} supplierId={overlay.supplierId} supplierName={overlay.supplierName} />;
  return <OverlayBody key={`${overlay.type}-${'id' in overlay ? overlay.id : ''}`} overlay={overlay} onSaved={onSaved} />;
}

function ContextMenu({ overlay }: { overlay: Extract<Overlay, { type: 'ctx' }> }) {
  const { open, close, canManageSensitive = true } = useDesk();
  const { sales = [] } = useAppContext();
  const cancelledSale = overlay.kind === 'sale' && sales.find(sale => sale.id === overlay.id)?.status === 'CANCELADA';
  const phone = usePhoneLayout();
  useEscape(close);
  const edit = overlay.kind === 'eq' ? 'edit-eq' : overlay.kind === 'sale' ? 'edit-sale' : overlay.kind === 'cj' ? 'edit-cj' : overlay.kind === 'ot' ? 'edit-ot' : 'edit-cl';
  return (
    <div className="ov ctxov" onMouseDown={close}>
      <div className="ctx" style={phone ? undefined : { top: overlay.y, left: overlay.x }} onMouseDown={(event) => event.stopPropagation()}>
        {phone ? <div className="sheet-grab" aria-hidden="true" /> : null}
        <div className="ctxh">{overlay.label}</div>
        {!cancelledSale ? <button type="button" onClick={() => open({ type: edit, id: overlay.id } as Overlay)}><DeskIcon name="edit" size={18} />Editar</button> : null}
        {overlay.kind === 'sale' && (() => {
          const sale = sales.find((row) => row.id === overlay.id);
          return sale && sale.status === 'COMPLETADA' && !sale.voidedAt;
        })() ? <button type="button" onClick={() => open({ type: 'new-return', saleId: overlay.id })}><DeskIcon name="swap" size={18} />Devolver</button> : null}
        {phone && overlay.onSelect ? <button type="button" onClick={() => { overlay.onSelect?.(); close(); }}>Seleccionar varios</button> : null}
        {canManageSensitive ? <button className="danger" type="button" onClick={() => open({ type: 'del', kind: overlay.kind, id: overlay.id, label: overlay.label })}><DeskIcon name="trash" size={18} />{overlay.kind === 'sale' || overlay.kind === 'cj' ? 'Anular' : 'Archivar'}</button> : null}
      </div>
    </div>
  );
}

function OverlayBody({ overlay, onSaved }: { overlay: Overlay; onSaved?: () => void }) {
  const desk = useDesk();
  const ctx = useAppContext();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<{ id: string; entity: string; message: string } | null>(null);

  const run = async (action: () => Promise<unknown>, ok: string, options?: { keepOpen?: boolean; afterSuccess?: () => void }) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      onSaved?.();
      if (!options?.keepOpen) desk.close();
      options?.afterSuccess?.();
      const summary = result && typeof result === 'object' && 'summary' in result && typeof result.summary === 'string'
        ? result.summary
        : ok;
      desk.toast(summary);
    } catch (err) {
      const archived = archivedMatchOf(err);
      if (archived) {
        setMatch(archived);
        return;
      }
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar.'));
    } finally {
      setBusy(false);
    }
  };

  if (match && ctx.user) {
    const client = match.entity === 'client';
    return (
      <Dialog
        title={client ? 'Cliente archivado' : 'Equipo archivado'}
        text={match.message}
        ok="Restaurar"
        cancel="Volver"
        busy={busy}
        error={error}
        onClose={() => { if (!busy) setMatch(null); }}
        onOk={() => run(async () => {
          if (client) {
            await restoreBackendClient(ctx.user!, match.id);
            await ctx.reloadClients();
          } else {
            await restoreBackendInventoryItem(ctx.user!, match.id);
            await ctx.reloadInventory();
          }
        }, client ? 'Cliente restaurado' : 'Equipo restaurado')}
      />
    );
  }

  if (overlay.type === 'onboarding-stock') return <StockOnboarding onFinish={destination => { desk.close(); desk.go(destination); }} />;

  if (overlay.type === 'logout') {
    const google = ctx.user?.providerData?.some((provider) => provider.providerId === 'google.com');
    return (
      <Dialog
        className="logout-ask"
        title="¿Cerrar sesión?"
        text={google ? 'Vas a tener que volver a entrar con tu cuenta de Google.' : 'Vas a tener que volver a entrar con tu email y contraseña.'}
        ok="Cerrar sesión"
        onClose={desk.close}
        onOk={() => { markSessionClosed(ctx.appSession?.store?.name || 'tu tienda'); ctx.logout(); }}
      />
    );
  }

  if (overlay.type === 'del') {
    const sale = overlay.kind === 'sale' ? ctx.sales.find((row) => row.id === overlay.id) : undefined;
    const trade = overlay.kind === 'cj' ? ctx.tradeIns.find((row) => row.id === overlay.id) : undefined;
    const integratedSale = sale?.status !== 'CANCELADA' && Boolean(sale?.integratedOperation || sale?.tradeInId);
    const integratedTrade = trade ? isActiveTradeOperation(trade) : false;
    const cancelling = integratedSale || integratedTrade;
    const copy = {
      eq: ['este equipo', 'Equipo eliminado'],
      sale: [integratedSale ? 'la operación' : 'esta venta', integratedSale ? 'Operación cancelada' : 'Venta eliminada'],
      cj: [integratedTrade ? 'la operación' : 'este canje', integratedTrade ? 'Operación cancelada' : 'Canje eliminado'],
      cl: ['este cliente', 'Cliente eliminado'],
      ot: ['esta orden', 'Orden eliminada'],
    }[overlay.kind];
    const repair = overlay.kind === 'ot' ? (ctx.repairOrders ?? []).find((row) => row.id === overlay.id) : undefined;
    const returnsCredit = Boolean(repair && repair.deposit > 0);
    const creditDelete = overlay.kind === 'cl' && Boolean(error?.includes('saldo a favor'));
    if (cancelling) {
      return (
        <Dialog
          title="Cancelar operación"
          text={`${overlay.label} se cancelará y quedará en el historial.`}
          ok="Cancelar operación"
          cancel="Volver"
          danger
          busy={busy}
          error={error}
          onClose={desk.close}
          onOk={() => run(async () => {
            if (overlay.kind === 'sale') await ctx.deleteSale(overlay.id);
            if (overlay.kind === 'cj') await ctx.deleteTradeIn(overlay.id);
          }, copy[1])}
        />
      );
    }
    const voiding = overlay.kind === 'sale' || overlay.kind === 'cj';
    const title = overlay.kind === 'sale' ? `Anular venta ${overlay.label}` : overlay.kind === 'cj' ? 'Anular canje' : overlay.kind === 'ot' ? 'Archivar orden' : overlay.kind === 'cl' ? 'Archivar cliente' : 'Archivar equipo';
    const note = voiding
      ? 'El equipo vuelve a Disponible y se anula la comisión. Queda en «Anuladas» y no se puede deshacer.'
      : returnsCredit
        ? 'La orden queda archivada. Si tenía una seña aplicada, vuelve como saldo a favor del cliente. Podés restaurarla.'
        : overlay.kind === 'ot'
          ? 'La orden queda archivada. Podés restaurarla desde Archivados.'
          : overlay.kind === 'cl'
            ? 'El cliente queda archivado. Podés restaurarlo desde Archivados.'
            : 'Queda archivado. Podés restaurarlo desde Archivados.';
    return (
      <ReasonSheet
        title={title}
        subtitle={overlay.label}
        note={note}
        ok={voiding ? 'Anular' : 'Archivar'}
        danger={voiding}
        busy={busy}
        error={error}
        extra={creditDelete ? { label: 'Registrar devolución', onClick: () => { setError(null); desk.open({ type: 'cl', id: overlay.id }); } } : null}
        onClose={desk.close}
        onOk={(reason) => run(async () => {
          if (overlay.kind === 'eq') await ctx.deleteProduct(overlay.id, reason);
          if (overlay.kind === 'sale') await ctx.deleteSale(overlay.id, reason);
          if (overlay.kind === 'cj') await ctx.deleteTradeIn(overlay.id, reason);
          if (overlay.kind === 'cl') await ctx.deleteClient(overlay.id, reason);
          if (overlay.kind === 'ot') await ctx.deleteRepairOrder(overlay.id, reason);
        }, voiding ? 'Anulado' : 'Archivado')}
      />
    );
  }

  if (overlay.type === 'eq') return <EquipmentDetail id={overlay.id} />;
  if (overlay.type === 'new-eq' || overlay.type === 'edit-eq') return <EquipmentForm id={overlay.type === 'edit-eq' ? overlay.id : undefined} supplierId={overlay.type === 'new-eq' ? overlay.supplierId : undefined} run={run} busy={busy} error={error} />;
  if (overlay.type === 'batch-eq') return <BatchLoad />;
  if (overlay.type === 'scan-review') return <ScanReviewHost draft={overlay.draft} resume={overlay.resume} run={run} busy={busy} error={error} />;
  if (overlay.type === 'supplier') return <SupplierDetail id={overlay.id} />;
  if (overlay.type === 'new-supplier' || overlay.type === 'edit-supplier') return <SupplierForm id={overlay.type === 'edit-supplier' ? overlay.id : undefined} />;
  if (overlay.type === 'new-expense' || overlay.type === 'edit-expense') return <ExpenseForm id={overlay.type === 'edit-expense' ? overlay.id : undefined} />;
  if (overlay.type === 'new-return') return <ReturnForm saleId={overlay.saleId} />;
  if (overlay.type === 'return') return <ReturnDetail id={overlay.id} />;
  if (overlay.type === 'sale') return <SaleDetail id={overlay.id} run={run} busy={busy} error={error} />;
  if (overlay.type === 'new-sale' || overlay.type === 'edit-sale') {
    return <SaleForm id={overlay.type === 'edit-sale' ? overlay.id : undefined} preset={overlay.type === 'new-sale' ? { clientName: overlay.clientName, clientId: overlay.clientId, productId: overlay.productId, source: overlay.source, tradeInId: overlay.tradeInId, resumeAmount: overlay.resumeAmount } : undefined} run={run} busy={busy} error={error} />;
  }
  if (overlay.type === 'cj') return <TradeDetail id={overlay.id} source={overlay.source} kind={overlay.kind} run={run} busy={busy} error={error} />;
  if (overlay.type === 'new-cj' || overlay.type === 'edit-cj') return <TradeForm id={overlay.type === 'edit-cj' ? overlay.id : undefined} source={overlay.type === 'edit-cj' ? overlay.source : 'tradeins'} run={run} busy={busy} error={error} />;
  if (overlay.type === 'new-ot') return <RepairOrderForm busy={busy} error={error} />;
  if (overlay.type === 'ot') return <RepairOrderDetail id={overlay.id} busy={busy} />;
  if (overlay.type === 'edit-ot') return <RepairOrderEditor id={overlay.id} busy={busy} />;
  if (overlay.type === 'new-deposit') return <DepositForm clientId={overlay.id} />;
  if (overlay.type === 'repair-deposit') return <RepairDepositSheet repairId={overlay.id} />;
  if (overlay.type === 'cl') return <ClientDetail id={overlay.id} />;
  if (overlay.type === 'new-cl' || overlay.type === 'edit-cl') return <ClientForm id={overlay.type === 'edit-cl' ? overlay.id : undefined} run={run} busy={busy} error={error} />;
  if (overlay.type === 'store') return <StoreForm run={run} busy={busy} error={error} focusPhone={overlay.focus === 'phone'} />;
  if (overlay.type === 'warranty') return <WarrantyForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'periodic-report') return <PeriodicReportForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'contact') return <ContactForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'profile') return <ProfileForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'password') return <PasswordForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'invite') return <InviteForm initialUrl={overlay.url} />;
  if (overlay.type === 'invites') return <InvitesList />;
  return null;
}

const REASONS = ['Error de carga', 'Duplicado', 'Devolución', 'Otro'];

function ReasonSheet({ title, subtitle, note, ok, danger, busy, error, extra, onClose, onOk }: {
  title: string;
  subtitle?: string;
  note: string;
  ok: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  extra?: { label: string; onClick: () => void } | null;
  onClose: () => void;
  onOk: (reason: string) => void;
}) {
  const [chip, setChip] = useState('Error de carga');
  const [detail, setDetail] = useState('');
  const reason = [chip === 'Otro' ? '' : chip, detail.trim()].filter(Boolean).join(' · ').slice(0, 280);
  return <Sheet title={title} subtitle={subtitle} onClose={onClose} busy={busy} footer={<Actions primary={ok} secondary="Cancelar" danger={danger} busy={busy} onPrimary={() => onOk(reason)} onSecondary={onClose} />}>
    <div className="pending-sale"><div><b>Qué pasa</b><small>{note}</small></div></div>
    <p className="kicker">Motivo (opcional)</p>
    <div className="wchips">{REASONS.map((label) => <button key={label} type="button" className={`wchip${chip === label ? ' on' : ''}`} onClick={() => setChip(label)}>{label}</button>)}</div>
    <textarea aria-label="Detalle" maxLength={280} value={detail} placeholder="Agregá un detalle si querés" onChange={(event) => setDetail(event.target.value)} />
    <p className="mut">{detail.length}/280</p>
    {extra ? <button type="button" className="wlink" disabled={busy} onClick={extra.onClick}>{extra.label}</button> : null}
    {error ? <p className="ferr" role="alert">{error}</p> : null}
  </Sheet>;
}
