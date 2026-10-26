// Keep the request until Inventory mounts when importing from a supplier sheet.
let pending = false;
export const PRICE_TO_DEFINE_EVENT = 'desk-price-to-define';
export function requestPriceToDefineFilter() {
  pending = true;
  window.dispatchEvent(new Event(PRICE_TO_DEFINE_EVENT));
}
export function consumePriceToDefineFilter() {
  const requested = pending;
  pending = false;
  return requested;
}
