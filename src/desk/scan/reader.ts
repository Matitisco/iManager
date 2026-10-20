import { CameraDenied, type Crop, openRearStream, viewfinderCrop } from './camera-profile';
import { rawHasImei, SCAN_FORMATS, selectBarcodeRaw, type ScanHit, zxingRegions } from './select-code';

export { CameraDenied };

type NativeHit = { rawValue?: string; format?: string };

type NativeDetector = {
  detect: (source: CanvasImageSource) => Promise<NativeHit[]>;
};

type NativeDetectorCtor = {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

type ZxingReader = {
  read: (canvas: HTMLCanvasElement) => ScanHit[];
};

function nativeDetector() {
  return (window as Window & { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
}

async function createDetector() {
  const Detector = nativeDetector();
  if (!Detector) return null;
  try {
    let formats: string[] = [...SCAN_FORMATS];
    if (Detector.getSupportedFormats) {
      const supported = new Set(await Detector.getSupportedFormats());
      formats = formats.filter((format) => supported.has(format));
    }
    if (formats.length === 0) return null;
    return new Detector({ formats });
  } catch {
    return null;
  }
}

function paintFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, crop: Crop | null) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width < 2 || height < 2) return false;
  const sx = crop?.sx ?? 0;
  const sy = crop?.sy ?? 0;
  const sw = crop?.sw ?? width;
  const sh = crop?.sh ?? height;
  const destW = Math.max(1, Math.round(sw));
  const destH = Math.max(1, Math.round(sh));
  if (canvas.width !== destW) canvas.width = destW;
  if (canvas.height !== destH) canvas.height = destH;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(video, sx, sy, sw, sh, 0, 0, destW, destH);
  return true;
}

function viewfinder(video: HTMLVideoElement, frame: HTMLElement | null) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width < 2 || height < 2) return null;
  const region = frame?.getBoundingClientRect();
  if (!region || region.width <= 0) return null;
  return viewfinderCrop({ width, height }, video.getBoundingClientRect(), region);
}

function sliceCanvas(source: HTMLCanvasElement, region: Crop) {
  if (region.sx === 0 && region.sy === 0 && region.sw === source.width && region.sh === source.height) return source;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(region.sw));
  canvas.height = Math.max(1, Math.round(region.sh));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(source, region.sx, region.sy, region.sw, region.sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

let zxingReader: Promise<ZxingReader | null> | null = null;

function ensureZxing() {
  if (!zxingReader) zxingReader = loadZxing().catch(() => null);
  return zxingReader;
}

async function loadZxing(): Promise<ZxingReader> {
  const [browser, zxing] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const readers = [new zxing.Code128Reader(), new zxing.QRCodeReader(), new zxing.EAN13Reader()];
  const readOne = (canvas: HTMLCanvasElement): ScanHit | null => {
    if (canvas.width < 8 || canvas.height < 8) return null;
    try {
      const source = new browser.HTMLCanvasElementLuminanceSource(canvas);
      const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source));
      for (const reader of readers) {
        try {
          const result = reader.decode(bitmap);
          const formatId = result.getBarcodeFormat();
          const format = zxing.BarcodeFormat[formatId] ?? '';
          return { rawValue: result.getText(), format };
        } catch {
          // Un frame without a code is normal. These readers throw; they do not warn.
        } finally {
          reader.reset();
        }
      }
      return null;
    } catch {
      return null;
    }
  };
  return {
    read(canvas) {
      const hits: ScanHit[] = [];
      for (const region of zxingRegions(canvas.width, canvas.height)) {
        const hit = readOne(sliceCanvas(canvas, region));
        if (hit?.rawValue) hits.push(hit);
        if (rawHasImei(selectBarcodeRaw(hits))) break;
      }
      return hits;
    },
  };
}

async function readFrames(
  video: HTMLVideoElement,
  frame: HTMLElement | null,
  onCode: (raw: string) => void,
  signal: AbortSignal,
) {
  let detector = await createDetector();
  const cropCanvas = document.createElement('canvas');
  const fullCanvas = document.createElement('canvas');
  let lastZxing = 0;

  const loop = async () => {
    if (signal.aborted) return;
    try {
      const crop = viewfinder(video, frame);
      const paintedCrop = crop ? paintFrame(video, cropCanvas, crop) : false;
      const paintedFull = paintFrame(video, fullCanvas, null);
      let hits: ScanHit[] = [];
      if (detector) {
        const sources: CanvasImageSource[] = [];
        if (paintedCrop) sources.push(cropCanvas);
        if (paintedFull) sources.push(fullCanvas);
        if (sources.length === 0) sources.push(video);
        for (const source of sources) {
          try {
            const found = await detector.detect(source);
            hits.push(...found.map((hit) => ({ rawValue: hit.rawValue, format: hit.format })));
          } catch {
            detector = null;
            break;
          }
          if (rawHasImei(selectBarcodeRaw(hits))) break;
        }
      }
      let chosen = selectBarcodeRaw(hits);
      const now = performance.now();
      if (!rawHasImei(chosen) && (paintedCrop || paintedFull) && now - lastZxing >= 200) {
        lastZxing = now;
        const decoder = await ensureZxing();
        if (!signal.aborted && decoder) {
          const extra: ScanHit[] = [];
          if (paintedCrop) extra.push(...decoder.read(cropCanvas));
          if (!rawHasImei(selectBarcodeRaw([...hits, ...extra])) && paintedFull) extra.push(...decoder.read(fullCanvas));
          chosen = selectBarcodeRaw([...hits, ...extra]);
        }
      }
      if (chosen && !signal.aborted) onCode(chosen);
    } catch {
      // A single frame can fail while the camera is still starting.
    }
    if (signal.aborted) return;
    if (detector) requestAnimationFrame(() => void loop());
    else window.setTimeout(() => void loop(), 160);
  };

  void loop();
}

export async function watchCodes(
  video: HTMLVideoElement,
  onCode: (raw: string) => void,
  signal: AbortSignal,
  frame?: HTMLElement | null,
  deviceId?: string,
  fallbackDeviceId?: string,
) {
  const stream = await openRearStream(deviceId, signal, fallbackDeviceId);
  const release = () => {
    for (const track of stream.getTracks()) track.stop();
    if (video.srcObject === stream) video.srcObject = null;
  };
  if (signal.aborted) {
    release();
    throw new DOMException('aborted', 'AbortError');
  }
  signal.addEventListener('abort', release, { once: true });
  try {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    await video.play();
  } catch (error) {
    release();
    throw error;
  }
  if (!signal.aborted) void readFrames(video, frame ?? null, onCode, signal);
  return stream;
}

export function torchSupported(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
  return Boolean(caps?.torch);
}

export async function setTorch(stream: MediaStream, on: boolean) {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  await track.applyConstraints({ advanced: [{ torch: on }] } as unknown as MediaTrackConstraints);
}
