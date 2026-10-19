import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImeiScanField } from './ImeiScanField';

describe('IMEI scan field', () => {
  it('sends a scanner burst to onScan before the field strips characters', () => {
    const onScan = vi.fn();
    render(<ImeiScanField label="IMEI (opcional)" value="" onChange={vi.fn()} onScan={onScan} />);
    const input = screen.getByLabelText('IMEI (opcional)');
    for (const key of 'MLPF3LE/A 352098117744522') fireEvent.keyDown(input, { key });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onScan).toHaveBeenCalledWith('MLPF3LE/A 352098117744522');
  });

  it('shows the camera button only when a camera exists', async () => {
    render(<ImeiScanField label="IMEI (opcional)" value="" onChange={vi.fn()} onCamera={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Escanear con la cámara' })).not.toBeInTheDocument();

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices: vi.fn(async () => [{ kind: 'videoinput' }]) },
    });
    render(<ImeiScanField label="IMEI de la cámara" value="" onChange={vi.fn()} onCamera={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Escanear con la cámara' })).toBeInTheDocument();
    await waitFor(() => expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalled());
  });
});
