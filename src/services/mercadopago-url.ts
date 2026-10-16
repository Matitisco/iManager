const MP_HOST = /^(?:[a-z0-9-]+\.)*mercadopago\.com(?:\.[a-z]{2})?$/;

export function mercadoPagoCheckoutUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !MP_HOST.test(url.hostname.toLowerCase())) {
    throw new Error('No pudimos abrir Mercado Pago.');
  }
  return url.toString();
}

export function redirectToMercadoPago(value: string) {
  window.location.assign(mercadoPagoCheckoutUrl(value));
}
