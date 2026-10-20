import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { createWedgeBuffer } from '../../lib/keyboard-wedge';
import { usePhoneLayout } from '../section-notices';
import { Field } from '../ui';
import { CameraIcon } from './icons';
import { useCameraAvailable } from './use-camera';

export function ScanCameraButton({ onClick }: { onClick: () => void }) {
  const camera = useCameraAvailable();
  if (!camera) return null;
  return (
    <button type="button" className="scan-cam" aria-label="Escanear con la cámara" onClick={onClick}>
      <CameraIcon />
    </button>
  );
}

export function ScanReady() {
  const phone = usePhoneLayout();
  return (
    <p className="scan-ready">
      <i />
      {phone ? 'Listo para escanear' : 'Listo para escanear · lector USB o Bluetooth'}
    </p>
  );
}

export function ImeiScanField({
  label,
  value,
  onChange,
  onScan,
  onCamera,
  onEnter,
  error,
  placeholder = '15 dígitos',
  autoFocus = false,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onScan?: (raw: string) => void;
  onCamera?: () => void;
  onEnter?: () => void;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
  testId?: string;
}) {
  const wedge = useRef(createWedgeBuffer());
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const pushed = wedge.current.push(event.key);
    if (pushed.type === 'scan') {
      event.preventDefault();
      onScan?.(pushed.value);
      return;
    }
    if (pushed.type === 'enter') onEnter?.();
  };
  return (
    <div className="scan-block">
      <div className="scan-imei">
        <Field label={label} error={error}>
          <input
            value={value}
            placeholder={placeholder}
            inputMode="numeric"
            autoComplete="off"
            autoFocus={autoFocus}
            data-testid={testId}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </Field>
        {onCamera ? <ScanCameraButton onClick={onCamera} /> : null}
      </div>
      <ScanReady />
    </div>
  );
}
