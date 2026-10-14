import { useEffect, useRef, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User as FirebaseUser } from 'firebase/auth';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { createInvitation, listInvitations, revokeInvitation, type Invitation, type InvitationRole } from '../../services/invitations-api';
import { formatInputMoney, formatArDate, initials, parseMoney } from '../format';
import { usePhoneLayout } from '../section-notices';
import { Actions, Field, Segs, Sheet, useDesk } from '../ui';
import { manualQuoteOrderError } from '../../lib/manual-quote';
import { clearStoreContactOffer, normalizeInstagram, storeContactErrors } from '../../lib/store-contact';
import { clearBad, shareOrCopy, type FormProps } from './shared';
import { ROLE_LABEL } from '../../lib/roles';
import { DeskSelect } from '../select';

export function StoreForm({ run, busy, error, focusPhone = false }: FormProps & { focusPhone?: boolean }) {
  const { appSession, updateStore } = useAppContext();
  const { close } = useDesk();
  const isPhone = usePhoneLayout();
  const store = appSession?.store;
  const [name, setName] = useState(store?.name ?? '');
  const [taxId, setTaxId] = useState(store?.taxId ?? '');
  const [address, setAddress] = useState(store?.address ?? '');
  const [phone, setPhone] = useState(store?.phone ?? '');
  const [email, setEmail] = useState(store?.email ?? '');
  const [instagram, setInstagram] = useState(store?.instagram ?? '');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(store?.currency === 'USD' ? 'USD' : 'ARS');
  const [exchangeMode, setExchangeMode] = useState<'auto' | 'manual'>(store?.exchangeMode === 'manual' ? 'manual' : 'auto');
  const [exchangeSource, setExchangeSource] = useState<'blue' | 'oficial' | 'mep'>(store?.exchangeSource === 'oficial' || store?.exchangeSource === 'mep' ? store.exchangeSource : 'blue');
  const [manualBuy, setManualBuy] = useState(store?.manualBuy ? formatInputMoney(store.manualBuy) : '');
  const [manualSell, setManualSell] = useState(store?.manualSell ? formatInputMoney(store.manualSell) : '');
  const [bad, setBad] = useState<Record<string, string>>({});
  return (
    <Sheet title={isPhone ? 'Tienda' : 'Datos de la tienda'} subtitle={isPhone ? 'Configuración' : undefined} className="cfg-sheet" onClose={close}>
      {error && <div className="ferr">{error}</div>}
      {isPhone ? <h4 className="cfg-h">Información de la tienda</h4> : null}
      <Field label="Nombre" error={bad.name}><input value={name} onChange={(event) => { setName(event.target.value); clearBad(setBad, 'name'); }} /></Field>
      <Field label="CUIT"><input value={taxId} onChange={(event) => setTaxId(event.target.value)} /></Field>
      <Field label="Dirección"><input value={address} onChange={(event) => setAddress(event.target.value)} /></Field>
      <ContactFields phone={phone} email={email} instagram={instagram} instagramRequired bad={bad} focusPhone={focusPhone} onPhone={setPhone} onEmail={setEmail} onInstagram={setInstagram} onClear={(key) => clearBad(setBad, key)} />
      {isPhone ? <h4 className="cfg-h">Moneda y dólar</h4> : null}
      <Field label="Moneda principal">
        <DeskSelect label="Moneda principal" data-testid="store-currency" value={currency} disabled={busy} onChange={(value) => setCurrency(value === 'USD' ? 'USD' : 'ARS')} options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} />
      </Field>
      <Field label="Cotización del dólar">
        <DeskSelect label="Cotización del dólar" data-testid="store-exchange-mode" value={exchangeMode} disabled={busy} onChange={(value) => setExchangeMode(value as 'auto' | 'manual')}
          options={[{ value: 'auto', label: 'Automática desde DolarApi' }, { value: 'manual', label: 'Manual, la carga la tienda' }]} />
      </Field>
      {exchangeMode === 'auto' ? (
        <Field label="Tipo de dólar">
          <DeskSelect label="Tipo de dólar" data-testid="store-exchange-source" value={exchangeSource} disabled={busy} onChange={(value) => setExchangeSource(value as 'blue' | 'oficial' | 'mep')}
            options={[{ value: 'blue', label: 'Blue' }, { value: 'oficial', label: 'Oficial' }, { value: 'mep', label: 'MEP' }]} />
        </Field>
      ) : (
        <div className="frow">
          <Field label="Compra" error={bad.manualBuy}><input data-testid="store-manual-buy" inputMode="numeric" value={manualBuy} placeholder="Ej. 1200" onChange={(event) => { setManualBuy(formatInputMoney(parseMoney(event.target.value))); clearQuoteErrors(setBad); }} /></Field>
          <Field label="Venta" error={bad.manualSell}><input data-testid="store-manual-sell" inputMode="numeric" value={manualSell} placeholder="Ej. 1250" onChange={(event) => { setManualSell(formatInputMoney(parseMoney(event.target.value))); clearQuoteErrors(setBad); }} /></Field>
        </div>
      )}
      <Actions busy={busy} primary="Guardar" onSecondary={close} onPrimary={() => {
        const contact = storeContactErrors({ email, instagram }, { instagramRequired: true });
        const buy = parseMoney(manualBuy);
        const sell = parseMoney(manualSell);
        const manualGap = exchangeMode === 'manual' && ((buy > 0) !== (sell > 0));
        const quoteOrder = exchangeMode === 'manual' ? manualQuoteOrderError(buy, sell) : null;
        if (!name.trim() || contact.email || contact.instagram || manualGap || quoteOrder) {
          setBad({
            ...contact,
            ...(!name.trim() ? { name: 'Completá este dato' } : {}),
            ...(manualGap ? { manualBuy: 'Completá compra y venta', manualSell: 'Completá compra y venta' } : {}),
            ...(quoteOrder ? { manualBuy: quoteOrder, manualSell: quoteOrder } : {}),
          });
          return;
        }
        setBad({});
        void run(async () => {
        await updateStore({
          name: name.trim(),
          taxId: taxId.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          instagram: normalizeInstagram(instagram),
          currency,
          exchangeMode,
          exchangeSource,
          manualBuy: exchangeMode === 'manual' && buy > 0 ? buy : null,
          manualSell: exchangeMode === 'manual' && sell > 0 ? sell : null,
        });
        if (store?.id) clearStoreContactOffer(store.id);
      }, 'Tienda actualizada');
      }} />
    </Sheet>
  );
}

export function ContactForm({ run, busy, error }: FormProps) {
  const { appSession, updateStore } = useAppContext();
  const { close } = useDesk();
  const store = appSession?.store;
  const [phone, setPhone] = useState(store?.phone ?? '');
  const [email, setEmail] = useState(store?.email ?? '');
  const [instagram, setInstagram] = useState(store?.instagram ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});
  const dismiss = () => {
    if (store?.id) clearStoreContactOffer(store.id);
    close();
  };
  return (
    <Sheet title="Datos de contacto" subtitle="Podés completarlos ahora o más tarde desde Configuración." onClose={dismiss}>
      {error && <div className="ferr">{error}</div>}
      <ContactFields phone={phone} email={email} instagram={instagram} instagramRequired bad={bad} onPhone={setPhone} onEmail={setEmail} onInstagram={setInstagram} onClear={(key) => clearBad(setBad, key)} />
      <Actions busy={busy} primary="Guardar" secondary="Ahora no" onSecondary={dismiss} onPrimary={() => {
        const contact = storeContactErrors({ email, instagram }, { instagramRequired: true });
        if (contact.email || contact.instagram) { setBad(contact); return; }
        setBad({});
        void run(async () => {
          await updateStore({
            phone: phone.trim() || null,
            email: email.trim() || null,
            instagram: normalizeInstagram(instagram),
          });
          if (store?.id) clearStoreContactOffer(store.id);
        }, 'Datos de contacto guardados');
      }} />
    </Sheet>
  );
}

function clearQuoteErrors(setBad: Parameters<typeof clearBad>[0]) {
  clearBad(setBad, 'manualBuy');
  clearBad(setBad, 'manualSell');
}

function ContactFields({ phone, email, instagram, instagramRequired, bad, focusPhone, onPhone, onEmail, onInstagram, onClear }: {
  phone: string;
  email: string;
  instagram: string;
  instagramRequired?: boolean;
  bad: Record<string, string>;
  focusPhone?: boolean;
  onPhone: (value: string) => void;
  onEmail: (value: string) => void;
  onInstagram: (value: string) => void;
  onClear: (key: string) => void;
}) {
  return (
    <>
      <Field label="Teléfono"><input id="store-phone" value={phone} inputMode="tel" placeholder="Ej. 11 5555 5555" autoFocus={focusPhone} onChange={(event) => onPhone(event.target.value)} /></Field>
      <Field label="Correo electrónico" error={bad.email}><input type="email" value={email} placeholder="hola@tienda.com" onChange={(event) => { onEmail(event.target.value); onClear('email'); }} /></Field>
      <Field label="Instagram" mark={instagramRequired ? 'obligatorio' : undefined} error={bad.instagram}><input value={instagram} placeholder="@tienda o instagram.com/tienda" onChange={(event) => { onInstagram(event.target.value); onClear('instagram'); }} /></Field>
    </>
  );
}

export function ProfileForm({ run, busy, error }: FormProps) {
  const { appSession, updateUserProfile } = useAppContext();
  const { close } = useDesk();
  const isPhone = usePhoneLayout();
  const [name, setName] = useState(appSession?.user.displayName ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});
  const email = appSession?.user.email ?? '';
  const shown = name.trim() || appSession?.user.displayName || 'Usuario';
  const role = appSession?.membership?.role;
  const roleLabel = (role && ROLE_LABEL[role]) || '';
  return (
    <Sheet title="Perfil" subtitle={isPhone ? 'Configuración' : undefined} className="cfg-sheet" onClose={close}>
      {error && <div className="ferr">{error}</div>}
      {isPhone ? (
        <div className="cfg-who">
          <div className="av-c k">{initials(shown)}</div>
          <div>
            <b>{shown}</b>
            <small>{email}</small>
          </div>
        </div>
      ) : null}
      {isPhone ? <h4 className="cfg-h">Mi perfil</h4> : null}
      <Field label="Nombre" error={bad.name}><input value={name} onChange={(event) => { setName(event.target.value); clearBad(setBad, 'name'); }} /></Field>
      <Field label="Email"><input type="email" value={email} disabled /></Field>
      {isPhone && roleLabel ? <Field label="Rol"><input value={roleLabel} disabled /></Field> : null}
      <Actions busy={busy} primary="Guardar" onSecondary={close} onPrimary={() => {
        if (!name.trim()) { setBad({ name: 'Completá este dato' }); return; }
        setBad({});
        void run(async () => {
        await updateUserProfile({ displayName: name.trim() });
      }, 'Perfil actualizado');
      }} />
    </Sheet>
  );
}

export function PasswordForm({ run, busy, error }: FormProps) {
  const { user } = useAppContext();
  const { close } = useDesk();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [bad, setBad] = useState<Record<string, string>>({});
  const emailUser = user?.providerData?.some((provider) => provider.providerId === 'password') ?? false;
  if (!emailUser) {
    return <Sheet className="cfg-sheet" title="Seguridad" subtitle="Esta cuenta entra con Google. La contraseña se administra ahí." onClose={close}><div className="sacts one"><button className="btn2 p" type="button" onClick={close}>Entendido</button></div></Sheet>;
  }
  return (
    <Sheet className="cfg-sheet" title="Cambiar contraseña" subtitle="Usá al menos 8 caracteres." onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <Field label="Contraseña actual" error={bad.current}><input type="password" value={current} onChange={(event) => { setCurrent(event.target.value); clearBad(setBad, 'current'); }} /></Field>
      <Field label="Nueva contraseña" error={bad.next}><input type="password" value={next} onChange={(event) => { setNext(event.target.value); clearBad(setBad, 'next'); }} /></Field>
      <Field label="Repetir nueva" error={bad.repeat}><input type="password" value={repeat} onChange={(event) => { setRepeat(event.target.value); clearBad(setBad, 'repeat'); }} /></Field>
      <Actions busy={busy} primary="Actualizar" onSecondary={close} onPrimary={() => {
        const fields: Record<string, string> = {};
        if (!current) fields.current = 'Completá este dato';
        if (!next) fields.next = 'Completá este dato';
        else if (next.length < 8) fields.next = 'Mínimo 8 caracteres';
        if (!repeat) fields.repeat = 'Completá este dato';
        else if (next && next !== repeat) fields.repeat = 'No coinciden';
        setBad(fields);
        if (Object.keys(fields).length) return;
        void run(async () => {
        if (!user?.email || !('reload' in user)) throw new Error('No se pudo validar la sesión.');
        const firebaseUser = user as FirebaseUser;
        const credential = EmailAuthProvider.credential(user.email, current);
        await reauthenticateWithCredential(firebaseUser, credential);
        await updatePassword(firebaseUser, next);
      }, 'Contraseña actualizada');
      }} />
    </Sheet>
  );
}

export function InviteForm({ initialUrl }: { initialUrl?: string }) {
  const { user, appSession } = useAppContext();
  const { close, toast } = useDesk();
  const isPhone = usePhoneLayout();
  const [role, setRole] = useState<InvitationRole>('STAFF');
  const [url, setUrl] = useState(initialUrl ?? '');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);
  useEffect(() => () => { if (copiedTimer.current) window.clearTimeout(copiedTimer.current); }, []);
  const store = appSession?.store?.name || 'la tienda';
  const roleLabel = ROLE_LABEL[role];
  const copy = () => navigator.clipboard.writeText(url).then(() => {
    toast('Link copiado');
    if (!isPhone) return;
    setCopied(true);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
  });
  const share = () => shareOrCopy({ title: 'Invitación a iManager', url }, copy);
  return (
    <Sheet
      className="cfg-sheet"
      title={url ? 'Link listo' : 'Invitar al equipo'}
      subtitle={url ? `Pasáselo a quien quieras sumar como ${roleLabel}. Sirve para una sola persona${expires ? ` y vence el ${expires}` : ''}.` : `Generá un link de un solo uso para sumar a alguien a ${store}.`}
      onClose={close}
    >
      {error && <div className="ferr">{error}</div>}
      {url ? (
        <>
          <div className="linkrow"><span>{url}</span><button className="copy" type="button" data-testid="invite-copy" onClick={() => { void copy(); }}>{copied ? 'Copiado' : 'Copiar'}</button></div>
          <p className="sheet-note">Cuando alguien entra con el link, deja de funcionar. Lo podés cancelar desde Configuración.</p>
        </>
      ) : (
        <>
          <Field label="Rol"><span /></Field>
          <Segs options={[{ id: 'STAFF', label: 'Empleado' }, { id: 'MANAGER', label: 'Socio' }]} value={role} onChange={(value) => setRole(value as InvitationRole)} />
          <p className="sheet-note">El Empleado carga equipos y ventas. El Socio además ve reportes y aprueba canjes.</p>
        </>
      )}
      {url ? (
        <div className="sacts">
          <button className="btn2 s" type="button" onClick={close}>Listo</button>
          <button className="btn2 p" type="button" data-testid="invite-share" onClick={share}>Compartir link</button>
        </div>
      ) : (
        <Actions busy={busy} primary="Generar link" onSecondary={close} onPrimary={() => {
          if (!user) return;
          setBusy(true);
          setError(null);
          createInvitation(user, undefined, role)
            .then((created) => {
              setUrl(created.inviteUrl);
              setExpires(formatArDate(new Date(created.expiresAt)));
              window.dispatchEvent(new Event('desk-invites'));
            })
            .catch((err) => setError(getFriendlyErrorMessage(err, 'No se pudo crear la invitación.')))
            .finally(() => setBusy(false));
        }} />
      )}
    </Sheet>
  );
}

export function InvitesList() {
  const { user } = useAppContext();
  const { close, toast } = useDesk();
  const [rows, setRows] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    if (!user) return;
    listInvitations(user).then(setRows).catch((err) => setError(getFriendlyErrorMessage(err, 'No se pudieron cargar las invitaciones.')));
  };
  useEffect(() => { load(); }, [user]);
  const when = (value: string) => formatArDate(new Date(value));
  return (
    <Sheet className="cfg-sheet" title="Links de invitación" subtitle="Cada link sirve una sola vez y vence solo." onClose={close}>
      {error && <div className="ferr">{error}</div>}
      {rows.length === 0 ? <div className="wempty">No quedan invitaciones.</div> : rows.map((invite) => (
        <div className="kv" key={invite.id}>
          <span>{ROLE_LABEL[invite.role] ?? 'Empleado'} · un solo uso · vence {when(invite.expiresAt)}</span>
          <button className="mbtn" type="button" onClick={() => {
            if (!user) return;
            revokeInvitation(user, invite.id)
              .then(() => { toast('Invitación cancelada'); load(); window.dispatchEvent(new Event('desk-invites')); })
              .catch((err) => setError(getFriendlyErrorMessage(err, 'No se pudo cancelar.')));
          }}>Cancelar</button>
        </div>
      ))}
      <div className="sacts one"><button className="btn2 s" type="button" onClick={close}>Listo</button></div>
    </Sheet>
  );
}
