import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraScanner } from './CameraScanner';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('camera scanner', () => {
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
});
