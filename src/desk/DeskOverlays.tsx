import { useModalLayer } from './modal-layer';
import { archivedReturn, voidedSale } from './archive-cache';
import { StockOnboarding } from '../pages/StockOnboarding';
import { DepositForm, RepairDepositSheet } from './overlays/deposits';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placeMenu } from './menu-position';
import { useAppContext } from '../context/AppContext';
import { getFriendlyErrorMessage } from '../lib/utils';
import { archivedMatchOf } from '../services/api-client';
import { restoreBackendClient } from '../services/clients-api';
import { restoreBackendInventoryItem } from '../services/inventory-api';
import { ReasonSheet } from './ReasonSheet';
export { ReasonSheet } from './ReasonSheet';
import { isActiveTradeOperation, isInStock, isVoidRow } from './format';
import { RepairOrderDetail, RepairOrderEditor, RepairOrderForm } from './RepairForms';
import { usePhoneLayout } from './section-notices';
import { DeskIcon, Dialog, useDesk, useEscape } from './ui';
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
import { ReturnDelete, ReturnDetail, ReturnForm } from './overlays/return-case';
import { SupplierDetail, SupplierForm } from './overlays/supplier';

export function DeskOverlays({ overlay, onSaved }: { overlay: Overlay | null; onSaved?: () => void | Promise<void> }) {
  if (!overlay) return null;
  if (overlay.type === 'ctx') return <ContextMenu overlay={overlay} />;
  if (overlay.type === 'import') return <ImportHost kind={overlay.kind} supplierId={overlay.supplierId} supplierName={overlay.supplierName} onSaved={onSaved} />;
  return <OverlayBody key={`${overlay.type}-${'id' in overlay ? overlay.id : ''}`} overlay={overlay} onSaved={onSaved} />;
}

function ContextMenu({ overlay }: { overlay: Extract<Overlay, { type: 'ctx' }> }) {
  const { open, close, canManageSensitive = true } = useDesk();
  const { sales = [], returns = [], inventory = [] } = useAppContext();
  const equipment = overlay.kind === 'eq' ? inventory.find(row => row.id === overlay.id) : null;
  const claim = overlay.kind === 'return' ? returns?.find(row => row.id === overlay.id) ?? archivedReturn(overlay.id) : null;
  const cancelledReturn = Boolean(claim && (claim.deletedAt || claim.status === 'ANULADO'));
  const sale = overlay.kind === 'sale' ? sales.find(row => row.id === overlay.id) ?? voidedSale(overlay.id) : null;
  const cancelledSale = Boolean(sale && isVoidRow(sale));
  const phone = usePhoneLayout();
  useEscape(close);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    if (phone) { menu.removeAttribute('style'); return; }
    const viewport = window.visualViewport;
    const place = () => {
      const bounds = {
        offsetLeft: viewport?.offsetLeft ?? 0,
        offsetTop: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
      };
      menu.style.setProperty('--ctx-max-width', `${Math.max(0, bounds.width - 24)}px`);
      menu.style.setProperty('--ctx-max-height', `${Math.max(0, bounds.height - 24)}px`);
      // offset dimensions exclude the existing pop animation's scale transform.
      const position = placeMenu({ anchor: overlay, viewport: bounds, size: {
        width: menu.offsetWidth,
        height: Math.max(menu.offsetHeight, menu.scrollHeight + menu.offsetHeight - menu.clientHeight),
      } });
      menu.style.setProperty('--ctx-max-height', `${position.maxHeight}px`);
      menu.style.left = `${position.left}px`;
      menu.style.top = `${position.top}px`;
      menu.style.transformOrigin = position.transformOrigin;
      menu.style.visibility = 'visible';
    };
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(menu);
    window.addEventListener('resize', place);
    viewport?.addEventListener('resize', place);
    viewport?.addEventListener('scroll', place);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
      viewport?.removeEventListener('resize', place);
      viewport?.removeEventListener('scroll', place);
    };
  }, [phone, overlay, cancelledSale, cancelledReturn, canManageSensitive]);
  useModalLayer({ ref: menuRef, onClose: close, enabled: overlay.kind === 'return' });
  useEffect(() => {
    if (overlay.kind !== 'return') return;
    const row = [...document.querySelectorAll<HTMLElement>('.return-row')].find(node => node.dataset.testid === `return-${overlay.id}`);
    row?.classList.add('ctx-on');
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => { row?.classList.remove('ctx-on'); };
  }, [overlay.kind, overlay.id]);
  const menuKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (overlay.kind !== 'return' || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next].focus();
  };
  const edit = overlay.kind === 'return' ? 'edit-return' : overlay.kind === 'eq' ? 'edit-eq' : overlay.kind === 'sale' ? 'edit-sale' : overlay.kind === 'cj' ? 'edit-cj' : overlay.kind === 'ot' ? 'edit-ot' : 'edit-cl';
  return (
    <div className="ov ctxov" onMouseDown={close}>
      <div ref={menuRef} tabIndex={overlay.kind === 'return' ? -1 : undefined} className={`ctx${overlay.kind === 'return' ? ' return-menu' : ''}`} onKeyDown={menuKeys} role={overlay.kind === 'return' ? 'menu' : undefined} aria-label={overlay.kind === 'return' ? `Acciones de ${overlay.label}` : undefined} style={phone ? undefined : { visibility: 'hidden' }} onMouseDown={(event) => event.stopPropagation()}>
        {phone ? <div className="sheet-grab" aria-hidden="true" /> : null}
        <div data-ph-mask={['cl', 'sale', 'cj', 'return'].includes(overlay.kind) || undefined} className="ctxh">{claim ? `${claim.code} · ${claim.clientName || 'Sin cliente'}` : overlay.label}</div>
        {!cancelledSale ? <button type="button" role={overlay.kind === 'return' ? 'menuitem' : undefined} disabled={cancelledReturn} onClick={() => open({ type: edit, id: overlay.id } as Overlay)}><DeskIcon name="edit" size={18} />Editar</button> : null}
        {equipment && isInStock(equipment.status) && !equipment.archivedAt ? <button type="button" onClick={() => open({ type: 'new-sale', productId: equipment.id, source: 'inventory' })}><DeskIcon name="cart" size={18} />Vender</button> : null}
        {overlay.kind === 'sale' && (() => {
          const sale = sales.find((row) => row.id === overlay.id);
          return sale && sale.status === 'COMPLETADA' && !sale.voidedAt;
        })() ? <button type="button" onClick={() => open({ type: 'new-return', saleId: overlay.id })}><DeskIcon name="swap" size={18} />Devolver</button> : null}
        {phone && overlay.onSelect ? <button type="button" onClick={() => { overlay.onSelect?.(); close(); }}>Seleccionar varios</button> : null}
        {canManageSensitive ? <button className="danger" type="button" role={overlay.kind === 'return' ? 'menuitem' : undefined} disabled={cancelledReturn} onClick={() => open({ type: 'del', kind: overlay.kind, id: overlay.id, label: overlay.label })}><DeskIcon name="trash" size={18} />{overlay.kind === 'return' || overlay.kind === 'sale' || overlay.kind === 'cj' ? 'Anular' : 'Archivar'}</button> : null}
      </div>
    </div>
  );
}

function OverlayBody({ overlay, onSaved }: { overlay: Overlay; onSaved?: () => void | Promise<void> }) {
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
      await onSaved?.();
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

  if (overlay.type === 'del' && overlay.kind === 'return') return <ReturnDelete id={overlay.id} />;

  if (overlay.type === 'del') {
    const sale = overlay.kind === 'sale' ? ctx.sales.find((row) => row.id === overlay.id) : undefined;
    const trade = overlay.kind === 'cj' ? ctx.tradeIns.find((row) => row.id === overlay.id) : undefined;
    const integratedSale = sale?.status !== 'CANCELADA' && Boolean(sale?.integratedOperation || sale?.tradeInId);
    const integratedTrade = trade ? isActiveTradeOperation(trade) : false;
    const cancelling = integratedSale || integratedTrade;
    const repair = overlay.kind === 'ot' ? (ctx.repairOrders ?? []).find((row) => row.id === overlay.id) : undefined;
    const returnsCredit = Boolean(repair && repair.deposit > 0);
    const creditDelete = overlay.kind === 'cl' && Boolean(error?.includes('saldo a favor'));
    const voiding = overlay.kind === 'sale' || overlay.kind === 'cj';
    const title = overlay.kind === 'sale' ? `Anular venta ${overlay.label}` : overlay.kind === 'cj' ? 'Anular canje' : overlay.kind === 'ot' ? 'Archivar orden' : overlay.kind === 'cl' ? 'Archivar cliente' : 'Archivar equipo';
    const note = cancelling ? 'Se anula la operación asociada: se restauran stock y saldos, se revierten pagos y comisiones y el equipo recibido del canje queda archivado. Sigue visible en rojo.' : voiding
      ? 'El equipo vuelve a Disponible y se anula la comisión. Sigue visible en rojo y no se puede deshacer.'
      : returnsCredit
        ? 'La orden queda archivada. Si tenía una seña aplicada, vuelve como saldo a favor del cliente. Podés restaurarla.'
        : overlay.kind === 'ot'
          ? 'La orden queda archivada. Podés restaurarla desde Archivados.'
          : overlay.kind === 'cl'
            ? 'El cliente queda archivado. Podés restaurarlo desde Archivados.'
            : 'Queda archivado. Podés restaurarlo desde Archivados.';
    return (
      <ReasonSheet
        maskTitle={overlay.kind === 'sale'}
        title={title}
        subtitle={overlay.label} maskSubtitle={['cl', 'sale', 'cj', 'return'].includes(overlay.kind)}
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
  if (overlay.type === 'edit-return') return <ReturnForm id={overlay.id} />;
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
