import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraScanner } from './CameraScanner';
import { Sheet } from '../ui';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('camera scanner', () => {
  it.each([false, true])('owns focus and Escape above the caller sheet (permission denied: %s)', async denied => {
    const user = userEvent.setup();
    const closeParent = vi.fn();
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const track = { getSettings: () => ({}), getCapabilities: () => ({}), stop: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: vi.fn(() => denied ? Promise.reject(new DOMException('denied', 'NotAllowedError')) : Promise.resolve({ getVideoTracks: () => [track], getTracks: () => [track] })),
      enumerateDevices: async () => [],
    } });
    function Example() {
      const [camera, setCamera] = useState(false);
      return <><Sheet title="Venta" onClose={closeParent}><button onClick={() => setCamera(true)}>Abrir cámara</button></Sheet>
        {camera ? <CameraScanner onClose={() => setCamera(false)} onManual={() => setCamera(false)} /> : null}</>;
    }
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Abrir cámara' });
    await user.click(trigger);
    const scanner = await screen.findByRole('dialog', { name: denied ? 'No tenemos acceso a la cámara' : 'Escanear IMEI' });
    expect(scanner).toContainElement(document.activeElement as HTMLElement);
    const manual = within(scanner).getByRole('button', { name: denied ? 'Escribir el IMEI' : 'Escribir a mano' });
    manual.focus();
    expect(manual).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(scanner).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Venta' })).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(closeParent).not.toHaveBeenCalled();
  });

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

  it('reads a code without exposing lens switching when the caller disables it', async () => {
    let readBarcode = false;
    let nextFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    });
    class Detector {
      static async getSupportedFormats() { return ['code_128', 'qr_code']; }
      async detect() { return readBarcode ? [{ rawValue: '352098117744522' }] : []; }
    }
    vi.stubGlobal('BarcodeDetector', Detector);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const enumerateDevices = vi.fn(async () => [
      { kind: 'videoinput', deviceId: 'main', label: 'camera2 0, facing back' },
      { kind: 'videoinput', deviceId: 'alternate', label: 'camera2 2, facing back' },
      { kind: 'videoinput', deviceId: 'front', label: 'camera2 1, facing front' },
    ]);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getVideoTracks: () => [{ getCapabilities: () => ({}), stop: vi.fn() }],
          getTracks: () => [{ stop: vi.fn() }],
        })),
        enumerateDevices,
      },
    });
    render(<CameraScanner allowCameraSwitch={false} onClose={vi.fn()} onManual={vi.fn()} onUse={vi.fn()} />);
    expect(await screen.findByTestId('scan-viewer')).toBeInTheDocument();
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Cambiar cámara' })).not.toBeInTheDocument();
    readBarcode = true;
    nextFrame?.(0);
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
