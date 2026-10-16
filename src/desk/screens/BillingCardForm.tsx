import { useEffect, useId, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { loadMercadoPago, type MercadoPagoFields, type SecureField } from '../../services/mercadopago-fields';

export function BillingCardForm({ publicKey, busy, onPay }: { publicKey: string; busy: boolean; onPay: (token: string) => Promise<void> }) {
  const id = useId().replace(/:/g, '');
  const sdk = useRef<MercadoPagoFields | null>(null);
  const sending = useRef(false);
  const [ready, setReady] = useState(false);
  const [tokenizing, setTokenizing] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [documents, setDocuments] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  useEffect(() => {
    let alive = true;
    const fields: SecureField[] = [];
    const fail = () => { if (alive) { setReady(false); setError('No pudimos cargar los campos de tarjeta. Reintentá.'); } };
    const timer = setTimeout(fail, 20_000);
    setReady(false); setError('');
    void (async () => {
      const Constructor = await loadMercadoPago();
      if (!alive) return;
      const mp = new Constructor(publicKey, { locale: 'es-AR' }); sdk.current = mp;
      const types = await mp.getIdentificationTypes();
      if (!alive) return;
      if (!types.length) throw new Error('No document types');
      setDocuments(types); setDocumentType(types.some(type => type.id === 'DNI') ? 'DNI' : types[0].id);
      let count = 0;
      for (const [type, label, placeholder] of [
        ['cardNumber', 'Número de tarjeta', 'Número de tarjeta'],
        ['expirationDate', 'Vencimiento', 'MM/AA'],
        ['securityCode', 'Código de seguridad', 'CVV'],
      ] as const) {
        const field = mp.fields.create(type, { placeholder, srLabel: label, ariaRequired: true, style: { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#16181d', placeholderColor: '#6b7280', height: '46px', padding: '12px' } });
        fields.push(field);
        field.on('ready', () => { if (alive && ++count === 3) { clearTimeout(timer); setReady(true); } });
        field.on('error', fail);
        field.mount(`${id}-${type}`);
      }
      let latestBin: string | undefined;
      fields[0].on('binChange', event => {
        latestBin = event.bin;
        if (!event.bin) return;
        void mp.getPaymentMethods({ bin: event.bin }).then(({ results }) => {
          if (!alive || latestBin !== event.bin) return;
          const method = results.find(result => ['credit_card', 'debit_card', 'prepaid_card'].includes(result.payment_type_id));
          const settings = method?.settings[0];
          if (settings) { fields[0].update({ settings: settings.card_number }); fields[2].update({ settings: settings.security_code }); }
        }).catch(() => { if (alive) setError('No pudimos verificar la tarjeta. Revisá tu conexión y reintentá.'); });
      });
    })().catch(fail);
    return () => { alive = false; clearTimeout(timer); sdk.current = null; fields.forEach(field => field.unmount()); };
  }, [publicKey, id, retry]);
  const disabled = busy || tokenizing;
  return <form className="billing-card-form" aria-label="Pago con tarjeta" onSubmit={event => {
    event.preventDefault();
    if (!ready || disabled || sending.current || !sdk.current) return;
    sending.current = true; setTokenizing(true); setError('');
    void (async () => {
      let token: { id: string } | undefined;
      try { token = await sdk.current!.fields.createCardToken({ cardholderName: name.trim(), identificationType: documentType, identificationNumber: documentNumber.trim() }); }
      catch { setError('Revisá el número, vencimiento, código de seguridad y datos del titular. No se envió la suscripción.'); return; }
      if (!token?.id) { setError('No pudimos validar la tarjeta. Revisá los datos y reintentá.'); return; }
      await onPay(token.id);
    })().finally(() => { sending.current = false; setTokenizing(false); });
  }}>
    <h3>Pagá con tarjeta</h3><p>No necesitás una cuenta de Mercado Pago.</p>
    <fieldset disabled={disabled}>
      <label className="billing-card-wide">Nombre del titular<input required autoComplete="cc-name" value={name} onChange={event => setName(event.target.value)} /></label>
      <div className="billing-card-wide"><span>Número de tarjeta</span><div className="billing-secure-field" id={`${id}-cardNumber`} /></div>
      <div><span>Vencimiento</span><div className="billing-secure-field" id={`${id}-expirationDate`} /></div>
      <div><span>Código de seguridad</span><div className="billing-secure-field" id={`${id}-securityCode`} /></div>
      <label>Tipo de documento<select value={documentType} onChange={event => setDocumentType(event.target.value)}>{documents.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
      <label>Documento del titular<input required inputMode="numeric" autoComplete="off" value={documentNumber} onChange={event => setDocumentNumber(event.target.value)} /></label>
    </fieldset>
    {!ready && !error ? <p role="status">Cargando campos seguros…</p> : null}
    {error ? <div className="billing-error" role="alert">{error}{!ready ? <button className="billing-link" type="button" onClick={() => setRetry(value => value + 1)}>Reintentar formulario</button> : null}</div> : null}
    <p className="billing-safe"><ShieldCheck size={17} />Mercado Pago protege los datos de tu tarjeta.</p>
    <button className="billing-primary" type="submit" disabled={!ready || disabled}>{disabled ? 'Procesando…' : 'Confirmar suscripción con tarjeta'}</button>
  </form>;
}
