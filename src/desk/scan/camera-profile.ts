export type CameraDevice = { deviceId: string; kind: string; label: string };

export type ZoomRange = { min?: number; max?: number; step?: number };

export type TrackCaps = {
  focusMode?: string[];
  zoom?: ZoomRange;
  torch?: boolean;
};

export type ScanVideoConstraints = {
  deviceId?: { exact: string };
  facingMode?: { ideal: 'environment' };
  width?: { min?: number; ideal: number };
  height?: { min?: number; ideal: number };
};

export type Box = { left: number; top: number; width: number; height: number };

export type Crop = { sx: number; sy: number; sw: number; sh: number };

export type TrackEnhancement = { focusMode?: 'continuous' | 'single-shot'; zoom?: number };

export class CameraDenied extends Error {
  constructor() {
    super('camera-denied');
    this.name = 'CameraDenied';
  }
}

const FRONT = /front|selfie|facetime|\buser\b|frontal/i;
const REAR = /back|rear|environment|trasera|posterior/i;
const AUX = /ultra[\s-]?wide|ultrawide|\bmacro\b|telephoto|\btele\b|\bdepth\b|\bmono\b|\bbokeh\b|infrared|\btof\b/i;

function permissionError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError';
}

function cameraIndex(label: string) {
  const match = label.match(/camera\s*2?\s*(\d+)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * Chrome on Android serves 640×480 when the request has no width or height.
 * Target HD without forcing a costly 4K stream, then relax until the camera accepts.
 */
export function videoConstraintLadder(deviceId?: string): ScanVideoConstraints[] {
  const device = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: { ideal: 'environment' as const } };
  return [
    { ...device, width: { min: 1920, ideal: 1920 }, height: { min: 1080, ideal: 1080 } },
    { ...device, width: { ideal: 1920 }, height: { ideal: 1080 } },
    { ...device, width: { ideal: 1280 }, height: { ideal: 720 } },
    { ...device },
  ];
}

/** Rear main sensor. Skips front, ultra-wide, macro and tele lenses when the label says so. */
function rearCandidates(devices: CameraDevice[]): CameraDevice[] {
  const videos = devices.filter((device) => device.kind === 'videoinput' && device.deviceId);
  const rear = videos.filter((device) => REAR.test(device.label) && !FRONT.test(device.label));
  return rear.length > 0 ? rear : videos.filter((device) => !FRONT.test(device.label));
}

export function pickMainCamera(devices: CameraDevice[]): string | null {
  const pool = rearCandidates(devices);
  if (pool.every((device) => device.label.trim() === '')) return null;
  if (pool.length === 0) return null;
  const preferred = pool.filter((device) => !AUX.test(device.label));
  const choices = (preferred.length > 0 ? preferred : pool).slice().sort((a, b) => {
    const byIndex = cameraIndex(a.label) - cameraIndex(b.label);
    return byIndex !== 0 ? byIndex : a.label.localeCompare(b.label);
  });
  return choices[0]?.deviceId ?? null;
}

/** Start at the native view rather than magnifying an already soft image. */
export function nativeZoom(range: ZoomRange | null | undefined): number | null {
  const min = range?.min;
  const max = range?.max;
  if (typeof min !== 'number' || typeof max !== 'number' || !(max > min)) return null;
  let chosen = Math.min(max, Math.max(min, 1));
  const step = range?.step;
  if (typeof step === 'number' && step > 0) {
    const steps = Math.round((chosen - min) / step);
    chosen = Math.min(max, Math.max(min, min + steps * step));
  }
  return Math.round(chosen * 100) / 100;
}

export function enhancementConstraints(caps: TrackCaps | null | undefined): TrackEnhancement[] {
  if (!caps) return [];
  const advanced: TrackEnhancement[] = [];
  if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
  else if (caps.focusMode?.includes('single-shot')) advanced.push({ focusMode: 'single-shot' });
  const zoom = nativeZoom(caps.zoom);
  if (zoom != null) advanced.push({ zoom });
  return advanced;
}

/**
 * Maps the on-screen viewfinder to sensor pixels.
 * `sw`/`sh` stay in source pixels: the caller draws them 1:1 and does not scale the crop down.
 */
export function viewfinderCrop(video: { width: number; height: number }, display: Box, frame: Box): Crop | null {
  if (video.width < 2 || video.height < 2 || display.width < 2 || display.height < 2 || frame.width < 2 || frame.height < 2) {
    return null;
  }
  const scale = Math.max(display.width / video.width, display.height / video.height);
  if (!(scale > 0)) return null;
  const offsetX = display.left + (display.width - video.width * scale) / 2;
  const offsetY = display.top + (display.height - video.height * scale) / 2;
  let sx = (frame.left - offsetX) / scale;
  let sy = (frame.top - offsetY) / scale;
  let sw = frame.width / scale;
  let sh = frame.height / scale;
  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > video.width) sw = video.width - sx;
  if (sy + sh > video.height) sh = video.height - sy;
  if (sw < 8 || sh < 8) return null;
  return { sx, sy, sw, sh };
}

function assertActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
}

async function requestStream(deviceId?: string, signal?: AbortSignal): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) throw new Error('camera-unavailable');
  let last: unknown;
  for (const video of videoConstraintLadder(deviceId)) {
    assertActive(signal);
    try {
      return await media.getUserMedia({ audio: false, video: video as MediaTrackConstraints });
    } catch (error) {
      if (permissionError(error)) throw new CameraDenied();
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error('camera-unavailable');
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

export async function listRearCameras(): Promise<CameraDevice[]> {
  try {
    const enumerate = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
    if (!enumerate) return [];
    const devices = await enumerate();
    return rearCandidates(devices.map((device) => ({
      deviceId: device.deviceId,
      kind: device.kind,
      label: device.label,
    })));
  } catch {
    return [];
  }
}

export async function enhanceTrack(track: MediaStreamTrack) {
  let caps: TrackCaps = {};
  try {
    caps = (track.getCapabilities?.() ?? {}) as TrackCaps;
  } catch {
    caps = {};
  }
  const advanced = enhancementConstraints(caps);
  if (advanced.length === 0 || !track.applyConstraints) return;
  for (const entry of advanced) {
    try {
      await track.applyConstraints({ advanced: [entry] } as MediaTrackConstraints);
    } catch {
      // Try the next set. Focus and zoom are independent.
    }
  }
}

let opening: Promise<void> = Promise.resolve();

export function openRearStream(deviceId?: string, signal?: AbortSignal, fallbackDeviceId?: string): Promise<MediaStream> {
  const request = opening.then(() => openRearStreamNow(deviceId, signal, fallbackDeviceId));
  opening = request.then(() => undefined, () => undefined);
  return request;
}

async function openRearStreamNow(deviceId?: string, signal?: AbortSignal, fallbackDeviceId?: string): Promise<MediaStream> {
  let stream: MediaStream | null = null;
  const release = () => {
    if (stream) stopStream(stream);
    stream = null;
  };
  signal?.addEventListener('abort', release, { once: true });
  try {
    try {
      stream = await requestStream(deviceId, signal);
    } catch (error) {
      assertActive(signal);
      if (error instanceof CameraDenied || !fallbackDeviceId || fallbackDeviceId === deviceId) throw error;
      stream = await requestStream(fallbackDeviceId, signal);
    }
    assertActive(signal);
    const currentId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
    const picked = deviceId ? null : pickMainCamera(await listRearCameras());
    assertActive(signal);
    if (picked && picked !== currentId) {
      // Many phones expose several lenses but can open only one at a time.
      release();
      try {
        stream = await requestStream(picked, signal);
      } catch (error) {
        assertActive(signal);
        if (error instanceof CameraDenied) throw error;
        stream = await requestStream(currentId, signal);
      }
    }
    assertActive(signal);
    if (!stream) throw new Error('camera-unavailable');
    const track = stream.getVideoTracks()[0];
    if (track) await enhanceTrack(track);
    assertActive(signal);
    return stream;
  } catch (error) {
    release();
    throw error;
  } finally {
    signal?.removeEventListener('abort', release);
  }
}
