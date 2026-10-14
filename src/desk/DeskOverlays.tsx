import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { getFriendlyErrorMessage } from '../lib/utils';
import { isActiveTradeOperation } from './format';
import { RepairOrderDetail, RepairOrderEditor, RepairOrderForm } from './RepairForms';
import { usePhoneLayout } from './section-notices';
import { DeskIcon, Dialog, useDesk, useEscape } from './ui';
import type { Overlay } from './types';
import { markSessionClosed } from './screens/SessionClosed';
import { EquipmentDetail, EquipmentForm } from './overlays/equipment';
import { SaleForm, SaleDetail } from './overlays/operation';
import { TradeForm, TradeDetail } from './overlays/trade';
import { ClientDetail, ClientForm } from './overlays/client';
import { StoreForm, ContactForm, ProfileForm, PasswordForm, InviteForm, InvitesList } from './overlays/account';
import { ImportHost } from './overlays/import';

export function DeskOverlays({ overlay }: { overlay: Overlay | null }) {
  if (!overlay) return null;
  if (overlay.type === 'ctx') return <ContextMenu overlay={overlay} />;
  if (overlay.type === 'import') return <ImportHost kind={overlay.kind} />;
  return <OverlayBody key={`${overlay.type}-${'id' in overlay ? overlay.id : ''}`} overlay={overlay} />;
}

function ContextMenu({ overlay }: { overlay: Extract<Overlay, { type: 'ctx' }> }) {
  const { open, close, canManageSensitive = true } = useDesk();
  const phone = usePhoneLayout();
  useEscape(close);
  const edit = overlay.kind === 'eq' ? 'edit-eq' : overlay.kind === 'sale' ? 'edit-sale' : overlay.kind === 'cj' ? 'edit-cj' : overlay.kind === 'ot' ? 'edit-ot' : 'edit-cl';
  return (
    <div className="ov ctxov" onMouseDown={close}>
      <div className="ctx" style={phone ? undefined : { top: overlay.y, left: overlay.x }} onMouseDown={(event) => event.stopPropagation()}>
        {phone ? <div className="sheet-grab" aria-hidden="true" /> : null}
        <div className="ctxh">{overlay.label}</div>
        <button type="button" onClick={() => open({ type: edit, id: overlay.id } as Overlay)}><DeskIcon name="edit" size={18} />Editar</button>
        {phone && overlay.onSelect ? <button type="button" onClick={() => { overlay.onSelect?.(); close(); }}>Seleccionar varios</button> : null}
        {canManageSensitive ? <button className="danger" type="button" onClick={() => open({ type: 'del', kind: overlay.kind, id: overlay.id, label: overlay.label })}><DeskIcon name="trash" size={18} />Eliminar</button> : null}
      </div>
    </div>
  );
}

function OverlayBody({ overlay }: { overlay: Overlay }) {
  const desk = useDesk();
  const ctx = useAppContext();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, ok: string, options?: { keepOpen?: boolean; afterSuccess?: () => void }) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (!options?.keepOpen) desk.close();
      options?.afterSuccess?.();
      const summary = result && typeof result === 'object' && 'summary' in result && typeof result.summary === 'string'
        ? result.summary
        : ok;
      desk.toast(summary);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar.'));
    } finally {
      setBusy(false);
    }
  };

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
    return (
      <Dialog
        title={cancelling ? 'Cancelar operaci\u00f3n' : overlay.kind === 'ot' ? 'Eliminar orden' : 'Eliminar registro'}
        text={cancelling ? `${overlay.label} se cancelar\u00e1 y quedar\u00e1 en el historial.` : `${overlay.label} se va a borrar y no se puede deshacer.`}
        ok={cancelling ? 'Cancelar operaci\u00f3n' : 'Eliminar'}
        cancel={cancelling ? 'Volver' : 'Cancelar'}
        danger
        busy={busy}
        error={error}
        onClose={desk.close}
        onOk={() => run(async () => {
          if (overlay.kind === 'eq') await ctx.deleteProduct(overlay.id);
          if (overlay.kind === 'sale') await ctx.deleteSale(overlay.id);
          if (overlay.kind === 'cj') await ctx.deleteTradeIn(overlay.id);
          if (overlay.kind === 'cl') await ctx.deleteClient(overlay.id);
          if (overlay.kind === 'ot') await ctx.deleteRepairOrder(overlay.id);
        }, copy[1])}
      />
    );
  }

  if (overlay.type === 'eq') return <EquipmentDetail id={overlay.id} />;
  if (overlay.type === 'new-eq' || overlay.type === 'edit-eq') return <EquipmentForm id={overlay.type === 'edit-eq' ? overlay.id : undefined} run={run} busy={busy} error={error} />;
  if (overlay.type === 'sale') return <SaleDetail id={overlay.id} run={run} busy={busy} error={error} />;
  if (overlay.type === 'new-sale' || overlay.type === 'edit-sale') {
    return <SaleForm id={overlay.type === 'edit-sale' ? overlay.id : undefined} preset={overlay.type === 'new-sale' ? { clientName: overlay.clientName, clientId: overlay.clientId, productId: overlay.productId, source: overlay.source, tradeInId: overlay.tradeInId } : undefined} run={run} busy={busy} error={error} />;
  }
  if (overlay.type === 'cj') return <TradeDetail id={overlay.id} source={overlay.source} kind={overlay.kind} run={run} busy={busy} error={error} />;
  if (overlay.type === 'new-cj' || overlay.type === 'edit-cj') return <TradeForm id={overlay.type === 'edit-cj' ? overlay.id : undefined} source={overlay.type === 'edit-cj' ? overlay.source : 'tradeins'} run={run} busy={busy} error={error} />;
  if (overlay.type === 'new-ot') return <RepairOrderForm busy={busy} error={error} />;
  if (overlay.type === 'ot') return <RepairOrderDetail id={overlay.id} busy={busy} />;
  if (overlay.type === 'edit-ot') return <RepairOrderEditor id={overlay.id} busy={busy} />;
  if (overlay.type === 'cl') return <ClientDetail id={overlay.id} />;
  if (overlay.type === 'new-cl' || overlay.type === 'edit-cl') return <ClientForm id={overlay.type === 'edit-cl' ? overlay.id : undefined} run={run} busy={busy} error={error} />;
  if (overlay.type === 'store') return <StoreForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'contact') return <ContactForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'profile') return <ProfileForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'password') return <PasswordForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'invite') return <InviteForm initialUrl={overlay.url} />;
  if (overlay.type === 'invites') return <InvitesList />;
  return null;
}
