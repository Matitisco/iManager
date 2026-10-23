import { imeiPassesLuhn } from './imei';
import { IMEI_TAC_DATA } from './imei-tac-data';

let modelsByTac: Map<string, string> | undefined;
function tacModels() {
  if (!modelsByTac) {
    modelsByTac = new Map();
    for (const [model, packed] of Object.entries(IMEI_TAC_DATA)) {
      let tac = 0;
      for (const delta of packed.split('.')) {
        tac += parseInt(delta, 36);
        modelsByTac.set(String(tac).padStart(8, '0'), model);
      }
    }
  }
  return modelsByTac;
}

export function lookupTacModel(imei: string): string | null {
  if (!/^\d{8}/.test(imei)) return null;
  return tacModels().get(imei.slice(0, 8)) ?? null;
}

export function imeiSpecs(imei: string): { model: string } | null {
  if (imei.length !== 15 || !imeiPassesLuhn(imei)) return null;
  const model = lookupTacModel(imei);
  return model ? { model } : null;
}
