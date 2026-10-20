import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enhancementConstraints,
  moderateZoom,
  openRearStream,
  pickMainCamera,
  videoConstraintLadder,
  viewfinderCrop,
} from './camera-profile';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('video constraints', () => {
  it('asks for 1920×1080 or higher before falling back', () => {
    const ladder = videoConstraintLadder();
    expect(ladder[0]).toEqual({
      facingMode: { ideal: 'environment' },
      width: { min: 1920, ideal: 3840 },
      height: { min: 1080, ideal: 2160 },
    });
    expect(ladder[1]).toMatchObject({ width: { ideal: 1920 }, height: { ideal: 1080 } });
    expect(ladder[2]).toMatchObject({ width: { ideal: 1280 }, height: { ideal: 720 } });
    expect(ladder[3]).toEqual({ facingMode: { ideal: 'environment' } });
    expect(JSON.stringify(ladder)).not.toMatch(/640|480/);
  });

  it('pins an enumerated camera by device id', () => {
    const ladder = videoConstraintLadder('main-cam');
    expect(ladder[0].deviceId).toEqual({ exact: 'main-cam' });
    expect(ladder[0].facingMode).toBeUndefined();
    expect(ladder[0].width).toEqual({ min: 1920, ideal: 3840 });
  });

  it('retries a looser request when the high resolution is rejected', async () => {
    const calls: unknown[] = [];
    const track = {
      getSettings: () => ({ deviceId: 'only', width: 1280, height: 720 }),
      getCapabilities: () => ({}),
      applyConstraints: vi.fn(),
      stop: vi.fn(),
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
          calls.push(constraints.video);
          if (calls.length === 1) throw new DOMException('too big', 'OverconstrainedError');
          return { getVideoTracks: () => [track], getTracks: () => [track] };
        }),
        enumerateDevices: vi.fn(async () => []),
      },
    });
    await openRearStream();
    expect(calls[0]).toMatchObject({ width: { min: 1920, ideal: 3840 } });
    expect(calls[1]).toMatchObject({ width: { ideal: 1920 }, height: { ideal: 1080 } });
    expect(calls).toHaveLength(2);
  });
});

describe('main camera selection', () => {
  const devices = [
    { deviceId: 'front', kind: 'videoinput', label: 'camera2 1, facing front' },
    { deviceId: 'ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
    { deviceId: 'macro', kind: 'videoinput', label: 'Back Macro Camera' },
    { deviceId: 'tele', kind: 'videoinput', label: 'Back Telephoto Camera' },
    { deviceId: 'wide', kind: 'videoinput', label: 'camera2 2, facing back' },
    { deviceId: 'main', kind: 'videoinput', label: 'camera2 0, facing back' },
  ];

  it('picks the lowest-index rear camera and skips ultra-wide, macro and tele', () => {
    expect(pickMainCamera(devices)).toBe('main');
  });

  it('prefers a labeled main sensor over the ultra-wide', () => {
    expect(pickMainCamera([
      { deviceId: 'uw', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
      { deviceId: 'main', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'front', kind: 'videoinput', label: 'Front Camera' },
    ])).toBe('main');
  });

  it('waits for labels before choosing', () => {
    expect(pickMainCamera([
      { deviceId: 'a', kind: 'videoinput', label: '' },
      { deviceId: 'b', kind: 'audioinput', label: 'Mic' },
    ])).toBeNull();
  });

  it('reopens the main rear camera and applies continuous focus plus a moderate zoom', async () => {
    const calls: MediaTrackConstraints[] = [];
    const stopUltra = vi.fn();
    const apply = vi.fn(async () => undefined);
    const caps = { focusMode: ['manual', 'continuous'], zoom: { min: 1, max: 8, step: 0.1 }, torch: true };
    const make = (id: string, stop = vi.fn()) => ({
      getSettings: () => ({ deviceId: id, width: 1920, height: 1080 }),
      getCapabilities: () => caps,
      applyConstraints: apply,
      stop,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
          const video = constraints.video as MediaTrackConstraints;
          calls.push(video);
          const id = video.deviceId ? 'main' : 'ultra';
          const track = make(id, id === 'ultra' ? stopUltra : vi.fn());
          return { getVideoTracks: () => [track], getTracks: () => [track] };
        }),
        enumerateDevices: vi.fn(async () => devices),
      },
    });
    const stream = await openRearStream();
    expect(calls[0]).toMatchObject({ facingMode: { ideal: 'environment' }, width: { min: 1920 } });
    expect(calls[1]).toMatchObject({ deviceId: { exact: 'main' }, width: { min: 1920, ideal: 3840 } });
    expect(stopUltra).toHaveBeenCalled();
    expect(stream.getVideoTracks()[0].getSettings().deviceId).toBe('main');
    expect(apply).toHaveBeenCalledWith({
      advanced: [{ focusMode: 'continuous', zoom: 1.8 }],
    });
  });
});

describe('focus and zoom', () => {
  it('uses continuous focus and a zoom between 1.5 and 2', () => {
    expect(moderateZoom({ min: 1, max: 8 })).toBe(1.75);
    expect(moderateZoom({ min: 1, max: 1.6 })).toBe(1.6);
    expect(moderateZoom({ min: 1, max: 8, step: 0.1 })).toBe(1.8);
    expect(moderateZoom({ min: 1, max: 1.2 })).toBeNull();
    expect(moderateZoom(undefined)).toBeNull();
    expect(enhancementConstraints({
      focusMode: ['single-shot', 'continuous'],
      zoom: { min: 1, max: 4 },
      torch: true,
    })).toEqual([{ focusMode: 'continuous' }, { zoom: 1.75 }]);
    expect(enhancementConstraints({ focusMode: ['manual'], torch: true })).toEqual([]);
  });
});

describe('viewfinder crop', () => {
  it('keeps the viewfinder in sensor pixels instead of css pixels', () => {
    const frame = { left: 35, top: 300, width: 320, height: 168 };
    const crop = viewfinderCrop(
      { width: 1920, height: 1080 },
      { left: 0, top: 100, width: 390, height: 700 },
      frame,
    );
    expect(crop).not.toBeNull();
    expect(crop!.sw).toBeGreaterThan(frame.width);
    expect(crop!.sh).toBeGreaterThan(frame.height);
    expect(Math.round(crop!.sw)).toBe(Math.round(crop!.sw));
    const scale = Math.max(390 / 1920, 700 / 1080);
    expect(crop!.sw).toBeCloseTo(frame.width / scale, 5);
    expect(crop!.sh).toBeCloseTo(frame.height / scale, 5);
  });
});
