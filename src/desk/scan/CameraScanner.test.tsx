import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraScanner } from './CameraScanner';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('camera scanner', () => {
  it('offers rear lens switching and releases the previous stream first', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const stopped = vi.fn();
    const getUserMedia = vi.fn(async ({ video }: MediaStreamConstraints) => {
      const requested = (video as MediaTrackConstraints).deviceId as { exact: string } | undefined;
      if (requested?.exact === 'alternate') expect(stopped).toHaveBeenCalled();
      const id = requested?.exact ?? 'main';
      const track = { getSettings: () => ({ deviceId: id }), getCapabilities: () => ({}), stop: id === 'main' ? stopped : vi.fn() };
      return { getVideoTracks: () => [track], getTracks: () => [track] };
    });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia,
      enumerateDevices: async () => [
        { kind: 'videoinput', deviceId: 'main', label: 'camera2 0, facing back' },
        { kind: 'videoinput', deviceId: 'alternate', label: 'camera2 2, facing back' },
        { kind: 'videoinput', deviceId: 'front', label: 'camera2 1, facing front' },
      ],
    } });
    const { unmount } = render(<CameraScanner onClose={vi.fn()} onManual={vi.fn()} onUse={vi.fn()} />);
    const change = await screen.findByRole('button', { name: 'Cambiar cámara' });
    await waitFor(() => expect(change).toBeEnabled());
    fireEvent.click(change);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ deviceId: { exact: 'alternate' } }) })));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('explains how to allow the camera when permission is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException('denied', 'NotAllowedError');
        }),
      },
    });
    render(<CameraScanner onClose={vi.fn()} onManual={vi.fn()} onUse={vi.fn()} />);
    expect(await screen.findByRole('dialog', { name: 'No tenemos acceso a la cámara' })).toBeInTheDocument();
    expect(screen.getByText(/Ajustes › Apps › Safari › Cámara/)).toBeInTheDocument();
    expect(screen.getByText(/Ajustes › iManager › Cámara/)).toBeInTheDocument();
    expect(screen.getByText(/Activá Cámara/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escribir el IMEI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('confirms a mocked BarcodeDetector read', async () => {
    let frames = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames += 1;
      if (frames < 4) callback(0);
      return frames;
    });
    class Detector {
      static async getSupportedFormats() { return ['code_128', 'qr_code']; }
      async detect() { return [{ rawValue: '352098117744522' }]; }
    }
    vi.stubGlobal('BarcodeDetector', Detector);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getVideoTracks: () => [{ getCapabilities: () => ({}), stop: vi.fn() }],
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    render(<CameraScanner onClose={vi.fn()} onManual={vi.fn()} onUse={vi.fn()} />);
    expect(await screen.findByText('IMEI leído')).toBeInTheDocument();
    expect(screen.getByText('35 209811 774452 2')).toBeInTheDocument();
    expect(screen.getByText('15 dígitos · control de dígito correcto')).toBeInTheDocument();
  });

  it('prefers the luhn imei when the label also has an ean-13', async () => {
    class Detector {
      static async getSupportedFormats() { return ['code_128', 'ean_13', 'qr_code']; }
      async detect() {
        return [
          { rawValue: '8806094745610', format: 'ean_13' },
          { rawValue: '355150550080984', format: 'code_128' },
        ];
      }
    }
    vi.stubGlobal('BarcodeDetector', Detector);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getVideoTracks: () => [{ getCapabilities: () => ({ torch: true }), stop: vi.fn() }],
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    render(<CameraScanner onClose={vi.fn()} onManual={vi.fn()} onUse={vi.fn()} />);
    expect(await screen.findByText('35 515055 008098 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Linterna' })).toBeInTheDocument();
    expect(screen.queryByText('8806094745610')).not.toBeInTheDocument();
  });
});
