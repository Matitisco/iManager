type BarcodeHit = { rawValue?: string };

type NativeDetector = {
  detect: (source: CanvasImageSource) => Promise<BarcodeHit[]>;
};

type NativeDetectorCtor = {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

export class CameraDenied extends Error {
  constructor() {
    super('camera-denied');
    this.name = 'CameraDenied';
  }
}

function nativeDetector() {
  return (window as Window & { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
}

export async function attachCamera(video: HTMLVideoElement) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    video.srcObject = stream;
    await video.play();
    return stream;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      throw new CameraDenied();
    }
    throw error;
  }
}

async function watchNative(video: HTMLVideoElement, onCode: (raw: string) => void, signal: AbortSignal) {
  const Detector = nativeDetector();
  if (!Detector) return false;
  let formats = ['code_128', 'qr_code'];
  try {
    if (Detector.getSupportedFormats) {
      const supported = await Detector.getSupportedFormats();
      formats = formats.filter((format) => supported.includes(format));
    }
    if (!formats.length) return false;
    const detector = new Detector({ formats });
    const loop = async () => {
      if (signal.aborted) return;
      try {
        const hits = await detector.detect(video);
        const raw = hits.find((hit) => hit.rawValue)?.rawValue;
        if (raw) onCode(raw);
      } catch {
        // A frame can fail while the camera is still starting.
      }
      if (!signal.aborted) requestAnimationFrame(() => void loop());
    };
    void loop();
    return true;
  } catch {
    return false;
  }
}

async function watchZxing(video: HTMLVideoElement, onCode: (raw: string) => void, signal: AbortSignal) {
  const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map();
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.CODE_128, zxing.BarcodeFormat.QR_CODE]);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
  const controls = await reader.decodeFromVideoElement(video, (result) => {
    if (!signal.aborted && result) onCode(result.getText());
  });
  signal.addEventListener('abort', () => controls.stop(), { once: true });
}

/** Native BarcodeDetector when the browser has it. ZXing loads only as a fallback. */
export async function watchCodes(video: HTMLVideoElement, onCode: (raw: string) => void, signal: AbortSignal) {
  const stream = await attachCamera(video);
  const release = () => {
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };
  if (signal.aborted) {
    release();
    throw new DOMException('aborted', 'AbortError');
  }
  signal.addEventListener('abort', release, { once: true });
  const native = await watchNative(video, onCode, signal);
  if (!native && !signal.aborted) await watchZxing(video, onCode, signal);
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
