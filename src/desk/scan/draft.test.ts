import { describe, expect, it } from 'vitest';
import { parseDeviceCode } from '../../lib/device-scan';
import { testImei } from '../../test/imei-fixture';
import { boxLabel, detectedWasEdited, draftFromCode, draftFromImei, editScanField } from './draft';

const other = testImei('35011042');
describe('TAC scan drafts', () => {
  it('marks the model detected without inventing label metadata or unit details', () => {
    const draft = draftFromImei('353893101224013');
    expect(draft).toMatchObject({ model: 'iPhone 11 Pro Max', capacity: '', color: '', battery: '', condition: '', cost: '', price: '', detected: { model: true }, touched: { model: false } });
    expect(boxLabel(draft)).toBe(false);
    expect(detectedWasEdited(draft)).toBe(false);
  });
  it('updates an untouched TAC model when editing the IMEI', () => {
    expect(editScanField(draftFromImei('353893101224013'), 'imei', other).model).toBe('iPhone 12');
    expect(editScanField(draftFromImei(testImei('00000000')), 'imei', other).detected.model).toBe(true);
  });
  it('preserves typed and cleared models, including those initially undetected', () => {
    for (const initial of ['353893101224013', testImei('00000000')]) {
      for (const model of ['Modelo propio', '']) {
        const draft = editScanField(draftFromImei(initial), 'model', model);
        expect(editScanField(draft, 'imei', other).model).toBe(model);
        expect(draft.touched.model).toBe(true);
      }
    }
  });
  it('preserves the label model when the IMEI changes and ignores invalid or unknown TAC', () => {
    const label = draftFromCode(parseDeviceCode('MLPF3LE/A 353893101224013'));
    expect(boxLabel(label)).toBe(true);
    expect(editScanField(label, 'imei', other).model).toBe('iPhone 13');
    for (const imei of [testImei('00000000'), '353893101224014']) {
      expect(editScanField(draftFromImei('353893101224013'), 'imei', imei).model).toBe('iPhone 11 Pro Max');
    }
  });
});
