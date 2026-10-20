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

export type TrackEnhancement = { focusMode?: 'continuous'; zoom?: number };

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
 * Ask for 1920×1080 or higher first, then relax until the camera accepts.
 */
export function videoConstraintLadder(deviceId?: string): ScanVideoConstraints[] {
  const device = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: { ideal: 'environment' as const } };
  return [
    { ...device, width: { min: 1920, ideal: 3840 }, height: { min: 1080, ideal: 2160 } },
    { ...device, width: { ideal: 1920 }, height: { ideal: 1080 } },
    { ...device, width: { ideal: 1280 }, height: { ideal: 720 } },
    { ...device },
  ];
}

/** Rear main sensor. Skips front, ultra-wide, macro and tele lenses when the label says so. */
export function pickMainCamera(devices: CameraDevice[]): string | null {
  const videos = devices.filter((device) => device.kind === 'videoinput' && device.deviceId);
  if (videos.length === 0 || videos.every((device) => device.label.trim() === '')) return null;
  const rear = videos.filter((device) => REAR.test(device.label) && !FRONT.test(device.label));
  const pool = rear.length > 0 ? rear : videos.filter((device) => !FRONT.test(device.label));
  if (pool.length === 0) return null;
  const preferred = pool.filter((device) => !AUX.test(device.label));
  const choices = (preferred.length > 0 ? preferred : pool).slice().sort((a, b) => {
    const byIndex = cameraIndex(a.label) - cameraIndex(b.label);
    return byIndex !== 0 ? byIndex : a.label.localeCompare(b.label);
  });
  return choices[0]?.deviceId ?? null;
}

/** About 1.5×–2× when the track advertises a zoom range. Null when that range cannot do it. */
export function moderateZoom(range: ZoomRange | null | undefined): number | null {
  const min = range?.min;
  const max = range?.max;
  if (typeof min !== 'number' || typeof max !== 'number' || !(max > min)) return null;
  let chosen = Math.min(max, 2, Math.max(min, 1.75));
  const step = range?.step;
  if (typeof step === 'number' && step > 0) {
    const steps = Math.round((chosen - min) / step);
    chosen = Math.min(max, Math.max(min, min + steps * step));
    chosen = Math.min(chosen, 2);
  }
  if (chosen < 1.5 || chosen > 2 || !(chosen > min)) return null;
  return Math.round(chosen * 100) / 100;
}

export function enhancementConstraints(caps: TrackCaps | null | undefined): TrackEnhancement[] {
  if (!caps) return [];
  const advanced: TrackEnhancement[] = [];
  if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
  const zoom = moderateZoom(caps.zoom);
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

async function requestStream(deviceId?: string): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) throw new Error('camera-unavailable');
  let last: unknown;
  for (const video of videoConstraintLadder(deviceId)) {
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

async function listMainCamera() {
  try {
    const enumerate = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
    if (!enumerate) return null;
    const devices = await enumerate();
    return pickMainCamera(devices.map((device) => ({
      deviceId: device.deviceId,
      kind: device.kind,
      label: device.label,
    })));
  } catch {
    return null;
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
  const together = Object.assign({}, ...advanced) as TrackEnhancement;
  const attempts = advanced.length > 1 ? [together, ...advanced] : advanced;
  for (const entry of attempts) {
    try {
      await track.applyConstraints({ advanced: [entry] } as MediaTrackConstraints);
      return;
    } catch {
      // Try the next set. Focus and zoom are independent.
    }
  }
}

export async function openRearStream(): Promise<MediaStream> {
  let stream = await requestStream();
  const currentId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
  const picked = await listMainCamera();
  if (picked && picked !== currentId) {
    try {
      const next = await requestStream(picked);
      stopStream(stream);
      stream = next;
    } catch (error) {
      if (error instanceof CameraDenied) {
        stopStream(stream);
        throw error;
      }
    }
  }
  const track = stream.getVideoTracks()[0];
  if (track) await enhanceTrack(track);
  return stream;
}
