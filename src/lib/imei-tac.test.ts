import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INVENTORY_MODELS } from '../../backend/src/lib/inventory-models';
import { APPLE_PARTS } from './apple-part-numbers';
import { IMEI_TAC_DATA } from './imei-tac-data';
import { imeiSpecs, lookupTacModel } from './imei-tac';
import { testImei } from '../test/imei-fixture';

describe('local TAC model lookup', () => {
  it('looks up the example without requiring Luhn in the low-level lookup', () => {
    expect(imeiSpecs('353893101224013')).toEqual({ model: 'iPhone 11 Pro Max' });
    expect(lookupTacModel('35389310')).toBe('iPhone 11 Pro Max');
    expect(lookupTacModel('353893101224014')).toBe('iPhone 11 Pro Max');
    expect(imeiSpecs('353893101224014')).toBeNull();
  });

  it('requires a complete Luhn IMEI for specs', () => {
    expect(imeiSpecs(testImei('35389310'))).toEqual({ model: 'iPhone 11 Pro Max' });
    for (const value of ['', '3538931', '35389310', '3538931012240130', '35389310122401x', '353893101224013\n']) expect(imeiSpecs(value)).toBeNull();
    expect(lookupTacModel('3538931')).toBeNull();
    expect(lookupTacModel('abcdefgh')).toBeNull();
    expect(lookupTacModel('00000000')).toBeNull();
    expect(imeiSpecs(testImei('00000000'))).toBeNull();
  });

  it('decodes all 18587 unique TAC with canonical models and preserves Apple labels', () => {
    const seen = new Set<string>();
    const labelModels = new Set<string>(Object.values(APPLE_PARTS).map(part => part[0]));
    for (const [model, packed] of Object.entries(IMEI_TAC_DATA)) {
      expect(INVENTORY_MODELS).toContain(model);
      if (model.startsWith('iPhone')) expect(labelModels.has(model)).toBe(true);
      else expect(labelModels.has(model)).toBe(false);
      let value = 0;
      for (const delta of packed.split('.')) {
        value += parseInt(delta, 36);
        const tac = String(value).padStart(8, '0');
        expect(tac).toMatch(/^\d{8}$/);
        expect(seen.has(tac)).toBe(false);
        seen.add(tac);
        expect(imeiSpecs(testImei(tac))).toEqual({ model });
      }
    }
    expect(seen.size).toBe(18587);
    for (const name of ['iphone', 'samsung']) {
      const rows = readFileSync(`scripts/data/${name}-tac.csv`, 'utf8').trim().split(/\r?\n/).slice(1);
      for (const row of rows) {
        const [tac, model] = row.split(',');
        expect(seen.has(tac)).toBe(true);
        if (name === 'samsung') expect(imeiSpecs(testImei(tac))).toEqual({ model });
      }
    }
  });

  it('resolves a real Samsung S24 Ultra TAC with Luhn and through the parser', () => {
    const tac = readFileSync('scripts/data/samsung-tac.csv', 'utf8').split(/\r?\n/).find(row => row.includes(',Samsung Galaxy S24 Ultra,'))!.slice(0, 8);
    expect(imeiSpecs(testImei(tac))).toEqual({ model: 'Samsung Galaxy S24 Ultra' });
  });
});
