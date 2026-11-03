import { Unzip, UnzipInflate, zipSync } from 'fflate';
import { SaxesParser } from 'saxes';

export const MAX_IMPORT_FILE_BYTES = 12 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
const LIMIT_MESSAGE = 'El XLSX excede los límites de importación o tiene una estructura inválida.';
const reject = (): never => { throw new Error(LIMIT_MESSAGE); };

export function assertImportFileSize(size: number) {
  if (size > MAX_IMPORT_FILE_BYTES) throw new Error('El archivo supera los 12 MB. Dividilo en archivos más chicos.');
}

function address(value: string): [number, number] {
  const match = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(value);
  if (!match) return reject();
  let col = 0;
  for (const char of match[1]) col = col * 26 + char.charCodeAt(0) - 64;
  const row = Number(match[2]);
  if (col > 16384 || row > 1048576) return reject();
  return [row, col];
}

/**
 * Validate actual streamed expansion, then repack only the inspected entries.
 * ExcelJS must not read the original ZIP: conflicting local/central-directory
 * headers could otherwise make it inflate content the preflight never checked.
 * No files are extracted to disk, and declared ZIP sizes are never trusted.
 */
export function safeXlsxBytes(input: Uint8Array): Uint8Array {
  assertImportFileSize(input.byteLength);
  if (input[0] !== 0x50 || input[1] !== 0x4b || input[2] !== 3 || input[3] !== 4) return reject();
  let expanded = 0;
  let finished = 0;
  let nodes = 0;
  let mergedCells = 0;
  let merges = 0;
  let columns = 0;
  const names = new Set<string>();
  const files: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>;
  try {
    const unzip = new Unzip(file => {
      if (names.has(file.name) || names.size >= 2048 || file.name.length > 512
        || file.name.includes('\\') || file.name.includes('\0') || file.name.startsWith('/')
        || file.name.split('/').some(part => part === '..' || part === '.')
        || (file.originalSize !== undefined && file.originalSize > MAX_EXPANDED_BYTES)) reject();
      names.add(file.name);
      const chunks: Uint8Array[] = [];
      let size = 0;
      let depth = 0;
      const xml = file.name.endsWith('.xml') || file.name.endsWith('.rels');
      const worksheet = file.name.startsWith('xl/worksheets/') && xml;
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const parser = xml ? new SaxesParser() : null;
      parser?.on('doctype', reject);
      parser?.on('opentag', tag => {
        if (++nodes > 2_000_000 || ++depth > 64) reject();
        if (!worksheet) return;
        if (tag.name === 'row') {
          const row = Number(tag.attributes.r);
          if (!Number.isInteger(row) || row < 1 || row > 1048576) reject();
        }
        if (tag.name === 'c') address(String(tag.attributes.r));
        if (tag.name === 'col') {
          const min = Number(tag.attributes.min), max = Number(tag.attributes.max);
          columns += max - min + 1;
          if (columns > 200_000 || !Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 16384) reject();
        }
        if (tag.name === 'mergeCell') {
          const parts = String(tag.attributes.ref).split(':');
          if (parts.length > 2) reject();
          const [top, left] = address(parts[0]);
          const [bottom, right] = address(parts[1] ?? parts[0]);
          mergedCells += (bottom - top + 1) * (right - left + 1);
          if (bottom < top || right < left || ++merges > 2000 || mergedCells > 200_000) reject();
        }
      });
      parser?.on('closetag', () => { depth--; });
      file.ondata = (error, chunk, final) => {
        if (error) reject();
        size += chunk.byteLength;
        expanded += chunk.byteLength;
        if (expanded > MAX_EXPANDED_BYTES) reject();
        if (parser) {
          parser.write(decoder.decode(chunk, { stream: !final }));
          if (final) parser.close();
        }
        chunks.push(chunk.slice());
        if (final) {
          const content = new Uint8Array(size);
          let offset = 0;
          for (const part of chunks) { content.set(part, offset); offset += part.length; }
          files[file.name] = content;
          finished++;
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    // A DEFLATE chunk can expand by ~1000x. Small input chunks bound temporary
    // allocations too, including when the ZIP lies about its original size.
    for (let offset = 0; offset < input.length; offset += 1024) {
      unzip.push(input.subarray(offset, offset + 1024), offset + 1024 >= input.length);
    }
    if (finished !== names.size || !files['[Content_Types].xml'] || !files['xl/workbook.xml']) reject();
    return zipSync(files, { level: 0 });
  } catch { return reject(); }
}
