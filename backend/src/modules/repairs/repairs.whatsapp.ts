export const REPAIR_RECEIVED = "RECIBIDO";
export const REPAIR_READY = "LISTO_PARA_RETIRAR";

export function repairCode(orderNumber: number) {
  return `OT-${String(orderNumber).padStart(4, "0")}`;
}

export function normalizeArWhatsapp(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("54")) {
    if (digits.length >= 12 && digits[2] !== "9") digits = `549${digits.slice(2)}`;
  } else {
    digits = `549${digits}`;
  }
  if (digits.length < 12 || digits.length > 15) return null;
  return digits;
}

export function repairReadyMessage(input: { clientName: string; device: string; code: string; storeName?: string | null }) {
  const place = input.storeName?.trim() ? ` en ${input.storeName.trim()}` : "";
  return `Hola ${input.clientName.trim()}, tu ${input.device.trim()} (orden #${input.code}) ya está listo para retirar${place}.`;
}

export function repairWhatsappUrl(phone: string, message: string): string | null {
  const digits = normalizeArWhatsapp(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
