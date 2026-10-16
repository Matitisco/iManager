// Only Mercado Pago's SDK sees PAN/CVV/expiry. The backend receives a single-use token.
export interface SecureField {
  mount(id: string): SecureField;
  unmount(): void;
  on(event: 'ready' | 'error' | 'binChange', callback: (event: { bin?: string }) => void): void;
  update(options: { settings: { length: number; validation?: string; mode?: string } }): void;
}
export interface MercadoPagoFields {
  fields: {
    create(type: 'cardNumber' | 'expirationDate' | 'securityCode', options: { placeholder: string; srLabel: string; ariaRequired: boolean; style: Record<string, string> }): SecureField;
    createCardToken(data: { cardholderName: string; identificationType: string; identificationNumber: string }): Promise<{ id: string } | undefined>;
  };
  getIdentificationTypes(): Promise<{ id: string; name: string }[]>;
  getPaymentMethods(data: { bin: string }): Promise<{ results: { payment_type_id: string; settings: { card_number: { length: number; validation: string }; security_code: { length: number; mode: string } }[] }[] }>;
}
type MercadoPagoConstructor = new (key: string, options: { locale: 'es-AR' }) => MercadoPagoFields;
declare global { interface Window { MercadoPago?: MercadoPagoConstructor } }
let loading: Promise<MercadoPagoConstructor> | undefined;
export function loadMercadoPago(): Promise<MercadoPagoConstructor> {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (loading) return loading;
  loading = new Promise<MercadoPagoConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(new Error('No pudimos cargar el formulario de tarjeta. Revisá tu conexión y reintentá.')); };
    const timer = setTimeout(fail, 15_000);
    script.src = 'https://sdk.mercadopago.com/js/v2'; script.async = true;
    script.onload = () => { if (!window.MercadoPago) return fail(); clearTimeout(timer); resolve(window.MercadoPago); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
