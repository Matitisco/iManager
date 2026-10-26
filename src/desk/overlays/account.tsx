import { toUserMessage, isNetworkErrorMessage } from '../../lib/user-message';
import { track } from '../../lib/analytics';
import { useEffect, useRef, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User as FirebaseUser } from 'firebase/auth';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { createInvitation, listInvitations, revokeInvitation, type Invitation, type InvitationRole } from '../../services/invitations-api';
import { INVITE_ROLE_SECTIONS, permissionSummary } from '../../lib/first-steps';
import { MemberPermissions } from '../screens/MemberPermissions';
import type { TeamMember } from '../../services/members-api';
import { ChevronRight, Link2 } from 'lucide-react';
import { formatInputMoney, formatArDate, initials, parseMoney } from '../format';
import { usePhoneLayout } from '../section-notices';
import { Actions, Field, Segs, Sheet, useDesk } from '../ui';
import { manualQuoteOrderError } from '../../lib/manual-quote';
import { clearStoreContactOffer, normalizeInstagram, storeContactErrors } from '../../lib/store-contact';
import { clearBad, type FormProps } from './shared';
import { DEFAULT_REPAIR_WARRANTY_DAYS, DEFAULT_SEALED_WARRANTY_DAYS, DEFAULT_USED_WARRANTY_DAYS, parseWarrantyDaysInput } from '../../lib/warranty';
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
      {error && !isNetworkErrorMessage(error) && <div className="ferr">{error}</div>}
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

export function WarrantyForm({ run, busy, error }: FormProps) {
  const { appSession, updateStore } = useAppContext();
  const { close } = useDesk();
  const isPhone = usePhoneLayout();
  const store = appSession?.store;
  const [used, setUsed] = useState(String(store?.usedWarrantyDays ?? DEFAULT_USED_WARRANTY_DAYS));
  const [sealed, setSealed] = useState(String(store?.sealedWarrantyDays ?? DEFAULT_SEALED_WARRANTY_DAYS));
  const [repair, setRepair] = useState(String(store?.repairWarrantyDays ?? DEFAULT_REPAIR_WARRANTY_DAYS));
  const [bad, setBad] = useState<Record<string, string>>({});
  const field = (key: string, label: string, value: string, setValue: (next: string) => void, testId: string) => (
    <Field label={label} error={bad[key]}>
      <input data-testid={testId} inputMode="numeric" value={value} onChange={(event) => { setValue(event.target.value.replace(/\D/g, '').slice(0, 4)); clearBad(setBad, key); }} />
    </Field>
  );
  return (
    <Sheet title={isPhone ? 'Garantías' : 'Garantías'} subtitle={isPhone ? 'Configuración' : 'Días que se precargan al vender o al crear una reparación.'} className="cfg-sheet" onClose={close}>
      {error && !isNetworkErrorMessage(error) && <div className="ferr">{error}</div>}
      <p className="sheet-note">Cada venta y cada reparación puede cambiar sus propios días. Lo ya cargado no se modifica.</p>
      {field('used', 'Usados (días)', used, setUsed, 'warranty-used-days')}
      {field('sealed', 'Sellados (días)', sealed, setSealed, 'warranty-sealed-days')}
      {field('repair', 'Reparaciones (días)', repair, setRepair, 'warranty-repair-days')}
      <Actions busy={busy} primary="Guardar" onSecondary={close} onPrimary={() => {
        const parsed = {
          used: parseWarrantyDaysInput(used),
          sealed: parseWarrantyDaysInput(sealed),
          repair: parseWarrantyDaysInput(repair),
        };
        const next: Record<string, string> = {};
        if (parsed.used.error || parsed.used.days === undefined) next.used = parsed.used.error ?? 'Completá los días';
        if (parsed.sealed.error || parsed.sealed.days === undefined) next.sealed = parsed.sealed.error ?? 'Completá los días';
        if (parsed.repair.error || parsed.repair.days === undefined) next.repair = parsed.repair.error ?? 'Completá los días';
        setBad(next);
        if (Object.keys(next).length) return;
        void run(async () => {
          await updateStore({
            usedWarrantyDays: parsed.used.days,
            sealedWarrantyDays: parsed.sealed.days,
            repairWarrantyDays: parsed.repair.days,
          });
        }, 'Garantías actualizadas');
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
      {error && !isNetworkErrorMessage(error) && <div className="ferr">{error}</div>}
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
      {error && !isNetworkErrorMessage(error) && <div className="ferr">{error}</div>}
      {isPhone ? (
        <div className="cfg-who">
          <div className="av-c k">{initials(shown)}</div>
          <div>
            <b>{shown}</b>
            <small data-ph-mask>{email}</small>
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
      {error && !isNetworkErrorMessage(error) && <div className="ferr">{error}</div>}
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
  const { user, appSession, refreshGettingStarted } = useAppContext();
  const owner = appSession?.membership?.role === 'OWNER';
  const { close, toast } = useDesk();
  const [role, setRole] = useState<InvitationRole>('STAFF');
  const [email, setEmail] = useState('');
  const [sections, setSections] = useState<string[]>(INVITE_ROLE_SECTIONS.STAFF);
  const [sensitive, setSensitive] = useState(false);
  const [url, setUrl] = useState(initialUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const copiedTimer = useRef<number | null>(null);
  useEffect(() => () => { if (copiedTimer.current) window.clearTimeout(copiedTimer.current); }, []);
  const access = { sections, sensitiveAccess: sensitive };
  const validEmail = () => {
    const target = email.trim();
    const invalid = Boolean(target && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target));
    setEmailError(invalid ? 'Ingresá un email válido.' : '');
    return !invalid;
  };
  const create = (target: string | undefined, reuse: boolean) => {
    if (!user) return Promise.reject(new Error('No hay sesión.'));
    if (reuse && url) return Promise.resolve(url);
    return createInvitation(user, target, role, access).then((created) => {
      setUrl(created.inviteUrl);
      window.dispatchEvent(new Event('desk-invites'));
      void refreshGettingStarted?.();
      return created.inviteUrl;
    });
  };
  const rememberCopy = () => {
    setCopied(true);
    toast('Link copiado');
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  const draft: TeamMember = {
    id: 'invite-draft',
    userId: 'invite-draft',
    role,
    isDefault: false,
    createdAt: new Date().toISOString(),
    sections,
    sensitiveAccess: sensitive,
    user: { id: 'invite-draft', displayName: email || 'Invitación', email: email || null, avatarUrl: null },
  };
  if (editing) {
    return (
      <div className="ov" onMouseDown={close}>
        <div className="sheet wide fresh-perms" role="dialog" aria-modal="true" aria-label="Permisos" onMouseDown={(event) => event.stopPropagation()}>
          <MemberPermissions
            key={`${role}:${sections.join(',')}:${sensitive}`}
            draft
            member={draft}
            onBack={() => setEditing(false)}
            onSaved={(saved) => {
              setSections(saved.sections ?? []);
              setSensitive(Boolean(saved.sensitiveAccess));
              setUrl('');
            }}
          />
        </div>
      </div>
    );
  }
  return (
    <Sheet
      className="cfg-sheet fresh-invite"
      title="Invitá a tu equipo"
      subtitle="Creá un link y compartilo. No se envía ningún email."
      onClose={close}
    >
      {error && !isNetworkErrorMessage(error) && <div className="ferr">{error}</div>}
      <Field label="Email (opcional)" error={emailError}>
        <input type="email" inputMode="email" autoComplete="email" aria-invalid={Boolean(emailError)} value={email} placeholder="martin@gmail.com" onChange={(event) => { setEmail(event.target.value); setEmailError(''); setUrl(''); }} />
      </Field>
      <Field label="Rol"><span /></Field>
      <Segs
        options={owner ? [{ id: 'STAFF', label: 'Empleado' }, { id: 'MANAGER', label: 'Socio' }] : [{ id: 'STAFF', label: 'Empleado' }]}
        value={role}
        onChange={(value) => {
          const next = value as InvitationRole;
          setRole(next);
          setSections(INVITE_ROLE_SECTIONS[next]);
          setSensitive(next === 'MANAGER');
          setUrl('');
        }}
      />
      <button className="fresh-perms-row" type="button" data-testid="invite-permissions" onClick={() => setEditing(true)}>
        <span className="ico" aria-hidden="true"><span /><span /><span /></span>
        <span><b>Permisos</b><small>{permissionSummary(sections)}</small></span>
        <ChevronRight size={18} />
      </button>
      {url ? <p className="invite-url" data-testid="invite-url">{url}</p> : null}
      <div className="fresh-invite-actions">
        <button className="dbtn p" type="button" data-testid="invite-send" disabled={busy} onClick={() => {
          const target = email.trim();
          if (!validEmail()) return;
          setBusy(true);
          setError(null);
          create(target || undefined, true)
            .then(() => { toast('Link de invitación creado'); })
            .catch((err) => setError(getFriendlyErrorMessage(err, 'No se pudo crear la invitación.')))
            .finally(() => setBusy(false));
        }}>{busy ? 'Creando…' : 'Crear link de invitación'}</button>
        <button className="fresh-copy" type="button" data-testid="invite-copy" disabled={busy} onClick={() => {
          if (!validEmail()) return;
          setBusy(true);
          setError(null);
          create(email.trim() || undefined, true)
            .then(async (link) => {
              try { await navigator.clipboard.writeText(link); track('invite_shared', { channel: 'copy' }); rememberCopy(); } catch { setError('Copiá el link que aparece arriba para compartirlo.'); }
            })
            .catch((err) => setError(getFriendlyErrorMessage(err, 'No se pudo crear la invitación.')))
            .finally(() => setBusy(false));
        }}>{copied ? 'Copiado' : <><Link2 size={15} /> Copiar link de invitación</>}</button>
      </div>
    </Sheet>
  );
}

export function InvitesList() {
  const { user, appSession } = useAppContext();
  const { close, toast } = useDesk();
  const [rows, setRows] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    if (!user) return;
    listInvitations(user).then(setRows).catch((err) => setError(toUserMessage(err, 'No se pudieron cargar las invitaciones.')));
  };
  useEffect(() => { load(); }, [user]);
  const when = (value: string) => formatArDate(new Date(value));
  return (
    <Sheet className="cfg-sheet" title="Links de invitación" subtitle="Cada link sirve una sola vez y vence solo." onClose={close}>
      {error && !isNetworkErrorMessage(error) && <div className="ferr">{error}</div>}
      {rows.length === 0 ? error ? null : <div className="wempty">No quedan invitaciones.</div> : rows.map((invite) => (
        <div className="kv" key={invite.id}>
          <span>{ROLE_LABEL[invite.role] ?? 'Empleado'} · un solo uso · vence {when(invite.expiresAt)}</span>
          <button className="mbtn" type="button" hidden={appSession?.membership?.role !== 'OWNER' && invite.role !== 'STAFF'} onClick={() => {
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
