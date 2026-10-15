import sharp from 'sharp';
import type { getPublicCatalog } from './service.js';
export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
}
export async function catalogPreviewPng(catalog: NonNullable<Awaited<ReturnType<typeof getPublicCatalog>>>) {
  const models = [...new Set(catalog.items.map(item => item.model))].slice(0, 4);
  const rows = models.map((model, index) => {
    const y = 220 + index * 78;
    const count = catalog.items.filter(item => item.model === model).length;
    return `<rect x="48" y="${y + 6}" width="${Math.min(700, model.length * 21)}" height="12" fill="#ffd000"/><text x="48" y="${y}" font-size="34" font-weight="bold">${escapeXml(model.slice(0, 40))}</text><text x="1130" y="${y}" text-anchor="end" font-size="26" fill="#737984">${count} ${count === 1 ? 'equipo' : 'equipos'}</text><path d="M48 ${y + 32}H1150" stroke="#e8dfca"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#fffdf4"/><rect width="1200" height="140" fill="#16181d"/><rect x="48" y="32" width="76" height="76" rx="20" fill="#ffd000"/><text x="86" y="82" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="28">${escapeXml(catalog.store.name.split(' ').map(word => word[0]).slice(0, 2).join(''))}</text><g font-family="sans-serif" fill="#16181d"><text x="146" y="80" font-size="36" font-weight="bold" fill="white">${escapeXml(catalog.store.name.slice(0, 34))}</text><text x="1150" y="120" text-anchor="end" font-size="18" font-weight="bold" fill="#ffd000" letter-spacing="3">LISTA DE PRECIOS</text>${rows || '<text x="600" y="300" text-anchor="middle" font-size="32">Lista no disponible</text>'}<text x="48" y="590" font-size="24" fill="#737984">${catalog.items.length} ${catalog.items.length === 1 ? 'equipo' : 'equipos'} · nuevos y usados · batería a la vista</text><text x="1150" y="590" text-anchor="end" font-size="22" fill="#737984">iManager</text></g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
