import { strToU8, unzipSync, zipSync, Zip, ZipDeflate } from 'fflate';
import { describe, expect, it } from 'vitest';
import { safeXlsxBytes } from './safe-xlsx.js';

const content = {
  '[Content_Types].xml': strToU8('<Types/>'),
  'xl/workbook.xml': strToU8('<workbook/>'),
};
const xml = (body: string) => zipSync({ ...content, 'xl/worksheets/sheet1.xml': strToU8(`<worksheet>${body}</worksheet>`) });

describe('bounded XLSX preflight', () => {
  it.each([
    '<mergeCell ref="A1:XFD1048576"/>',
    '<mergeCell ref="A0:B1"/>',
    '<mergeCell ref="B2:A1"/>',
    '<row r="999999999999"/>',
    '<c r="ZZZ1"/>',
    '<col min="1" max="999999999"/>',
    '<!DOCTYPE worksheet [<!ENTITY expand "boom">]><row r="1"/>',
    '<row r="1"><c r="A1"></row>',
    '<x>'.repeat(65) + '</x>'.repeat(65),
    '<col min="1" max="16384"/>'.repeat(13),
  ])('rejects dangerous or invalid XML before ExcelJS: %s', body => {
    expect(() => safeXlsxBytes(xml(body))).toThrow('límites');
  });

  it.each(['../outside', '/absolute', 'xl/../outside', 'xl\\outside', '__proto__/../bad'])('rejects ambiguous entry paths: %s', name => {
    expect(() => safeXlsxBytes(zipSync({ ...content, [name]: strToU8('test') }))).toThrow('límites');
  });

  it('rejects a disguised non-XLSX file', () => {
    expect(() => safeXlsxBytes(strToU8('not an XLSX'))).toThrow('límites');
    expect(() => safeXlsxBytes(zipSync({ 'only.txt': strToU8('not a workbook') }))).toThrow('límites');
  });

  it('bounds actual expansion even when ZIP headers understate its size', () => {
    const input = zipSync({ ...content, 'bomb.bin': new Uint8Array(32 * 1024 * 1024 + 1) });
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    // Understate every local original size; the streaming byte count still wins.
    for (let pos = 0; pos + 30 < input.length; pos++) {
      if (view.getUint32(pos, true) === 0x04034b50) view.setUint32(pos + 22, 1, true);
    }
    expect(() => safeXlsxBytes(input)).toThrow('límites');
  });

  it('accepts data descriptors and repacks the actual inspected bytes', () => {
    const chunks: Uint8Array[] = [];
    const archive = new Zip((error, data) => { if (error) throw error; chunks.push(data); });
    for (const [name, data] of Object.entries(content)) {
      const entry = new ZipDeflate(name);
      archive.add(entry);
      entry.push(data, true);
    }
    archive.end();
    const input = new Uint8Array(chunks.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const chunk of chunks) { input.set(chunk, offset); offset += chunk.length; }
    expect(unzipSync(safeXlsxBytes(input))).toEqual(content);
  });

  it('rejects duplicate local names rather than choosing an ambiguous entry', () => {
    const chunks: Uint8Array[] = [];
    const archive = new Zip((error, data) => { if (error) throw error; chunks.push(data); });
    for (const name of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/workbook.xml']) {
      const entry = new ZipDeflate(name);
      archive.add(entry);
      entry.push(strToU8('<workbook/>'), true);
    }
    archive.end();
    const input = new Uint8Array(chunks.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const chunk of chunks) { input.set(chunk, offset); offset += chunk.length; }
    expect(() => safeXlsxBytes(input)).toThrow('límites');
  });

  it('never forwards contradictory central-directory sizes to the next parser', () => {
    const input = zipSync(content);
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    for (let pos = 0; pos + 46 < input.length; pos++) {
      if (view.getUint32(pos, true) === 0x02014b50) view.setUint32(pos + 24, 0xffffffff, true);
    }
    expect(unzipSync(safeXlsxBytes(input))).toEqual(content);
  });

  it('preserves ordinary merges and trailing empty formatting', () => {
    const input = xml('<cols><col min="1" max="702"/></cols><sheetData><row r="100"><c r="ZZ100"/></row></sheetData><mergeCells><mergeCell ref="A1:B2"/></mergeCells>');
    expect(unzipSync(safeXlsxBytes(input))).toEqual(unzipSync(input));
  });
});
