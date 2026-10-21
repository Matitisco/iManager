import { useEffect, useRef, useState } from 'react';
import { extractImeiLoose, parseDeviceCode, type ParsedDeviceCode } from '../../lib/device-scan';
import { imeiPassesLuhn } from '../../lib/imei';
import { formatImei } from '../format';
import { confirmScan } from './beep';
import { CameraDenied, setTorch, torchSupported, watchCodes } from './reader';
import { listRearCameras, type CameraDevice } from './camera-profile';

export function CameraScanner({
  onClose,
  onUse,
  onManual,
  burst,
  onBurst,
  counts,
  loose,
  allowCameraSwitch = true,
}: {
  onClose: () => void;
  onUse?: (parsed: ParsedDeviceCode) => void;
  onManual: () => void;
  burst?: boolean;
  onBurst?: (raw: string, parsed: ParsedDeviceCode) => void;
  counts?: { ready: number; scanned: number };
  /** Stock codes already in the store may not pass the Luhn check. */
  loose?: boolean;
  /** Show rear-lens switching only in scanner contexts that support it. */
  allowCameraSwitch?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const onBurstRef = useRef(onBurst);
  onBurstRef.current = onBurst;
  const [denied, setDenied] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [parsed, setParsed] = useState<ParsedDeviceCode | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [cameraId, setCameraId] = useState<string>();
  const [activeCameraId, setActiveCameraId] = useState<string>();
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const lastWorkingCameraId = useRef<string | undefined>(undefined);
  const seen = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const burstSeen = useRef(new Set<string>());
  const holding = Boolean(parsed) && !burst;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || denied || holding) return;
    const signal = new AbortController();
    setCameraReady(false);
    setCanTorch(false);
    setTorchOn(false);
    setUnreadable(false);
    watchCodes(video, (raw) => {
      const now = Date.now();
      if (!burst && seen.current.value === raw && now - seen.current.at < 1500) return;
      if (!burst) seen.current = { value: raw, at: now };
      const next = parseDeviceCode(raw);
      const looseImei = extractImeiLoose(raw);
      const imei = loose ? (next.imei ?? looseImei) : next.imei;
      const rememberBurst = (value: string) => {
        if (burstSeen.current.has(value)) return false;
        burstSeen.current.add(value);
        return true;
      };
      if (!imei || (!loose && !imeiPassesLuhn(imei))) {
        if (burst && looseImei && imeiPassesLuhn(looseImei) === false && /^\d{15}$/.test(looseImei)) {
          if (!rememberBurst(looseImei)) return;
          next.imei = looseImei;
          onBurstRef.current?.(raw, next);
          return;
        }
        if (!burst) setUnreadable(true);
        return;
      }
      next.imei = imei;
      setUnreadable(false);
      if (burst) {
        if (!rememberBurst(imei)) return;
        onBurstRef.current?.(raw, next);
        return;
      }
      confirmScan();
      setParsed(next);
      signal.abort();
    }, signal.signal, frameRef.current, cameraId, lastWorkingCameraId.current).then(async (opened) => {
      if (signal.signal.aborted) return;
      setCanTorch(torchSupported(opened));
      const openedId = opened.getVideoTracks()[0]?.getSettings?.().deviceId;
      lastWorkingCameraId.current = openedId;
      setActiveCameraId(openedId);
      const available = allowCameraSwitch ? await listRearCameras() : [];
      if (signal.signal.aborted) return;
      setCameras(available);
      setCameraReady(true);
    }).catch((error: unknown) => {
      if (signal.signal.aborted) return;
      setCameraReady(true);
      if (error instanceof CameraDenied) setDenied(true);
      else setUnreadable(true);
    });
    return () => signal.abort();
  }, [allowCameraSwitch, attempt, burst, cameraId, denied, holding, loose]);

  if (denied) {
    return <CameraPermission onClose={onClose} onManual={onManual} onRetry={() => { setDenied(false); setAttempt((value) => value + 1); }} />;
  }

  const live = !parsed;

  const modelLine = parsed?.model
    ? [parsed.model, parsed.capacity, parsed.color].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="scan-viewer" role="dialog" aria-modal="true" aria-label="Escanear IMEI" data-testid="scan-viewer">
      <header className="scan-viewer-bar">
        <button type="button" className="scan-round" aria-label="Cerrar" onClick={onClose}>×</button>
        <b>Escanear IMEI</b>
        {canTorch ? (
          <button type="button" className={`scan-round${torchOn ? ' on' : ''}`} aria-label="Linterna" aria-pressed={torchOn} onClick={() => {
            const stream = videoRef.current?.srcObject;
            if (!(stream instanceof MediaStream)) return;
            const next = !torchOn;
            void setTorch(stream, next).then(() => setTorchOn(next)).catch(() => undefined);
          }}><TorchMark /></button>
        ) : <span className="scan-round ghost" />}
      </header>
      <div className="scan-stage">
        {burst && counts ? <span className="scan-pill" data-testid="scan-burst-count">{counts.ready === 1 ? '1 listo' : `${counts.ready} listos`} · {counts.scanned} escaneados</span> : null}
        <video ref={videoRef} className="scan-video" muted playsInline autoPlay />
        <div ref={frameRef} className={`scan-frame${live ? '' : ' ok'}`} aria-hidden="true">
          <i /><i /><i /><i />
          {live ? <span className="scan-laser" /> : null}
        </div>
        {allowCameraSwitch && live && cameras.length > 1 ? (
          <div className="scan-camera-controls">
            <button type="button" className="scan-camera-switch" disabled={!cameraReady} onClick={() => {
              const current = cameras.findIndex((camera) => camera.deviceId === (cameraId ?? activeCameraId));
              const next = cameras[(current + 1) % cameras.length];
              if (!next) return;
              setCameraId(next.deviceId);
              setAttempt((value) => value + 1);
            }}>Cambiar cámara</button>
          </div>
        ) : null}
        {live ? (
          <div className="scan-copy">
            <b>Apuntá al código de barras del IMEI</b>
            <p>En la etiqueta de la caja, en Ajustes › General › Información o en la bandeja SIM. También lee QR.</p>
            <p className="scan-focus-hint">Si no enfoca, alejá un poco el teléfono.</p>
            {unreadable ? <p className="scan-bad-copy">No pudimos leer un IMEI válido. Probá de nuevo o escribilo a mano.</p> : null}
          </div>
        ) : null}
      </div>
      {parsed?.imei ? (
        <section className="scan-ok" data-testid="scan-ok">
          <p className="scan-ok-title"><span>✓</span> IMEI leído</p>
          <b className="scan-ok-imei">{formatImei(parsed.imei)}</b>
          <p className="scan-ok-meta">{imeiPassesLuhn(parsed.imei) ? '15 dígitos · control de dígito correcto' : '15 dígitos'}</p>
          {modelLine ? (
            <div className="scan-ok-card">
              <b>{modelLine}</b>
              <small>Detectado en la etiqueta de la caja · se completa en el formulario</small>
            </div>
          ) : null}
          <div className="sacts">
            <button type="button" className="btn2 s" onClick={() => { setParsed(null); setAttempt((value) => value + 1); }}>Escanear otro</button>
            <button type="button" className="btn2 p" onClick={() => onUse?.(parsed)}>Usar</button>
          </div>
        </section>
      ) : (
        <div className="scan-manual">
          <button type="button" className="scan-manual-btn" onClick={onManual}>
            {burst ? `Listo · ver la lista (${counts?.scanned ?? 0})` : 'Escribir a mano'}
          </button>
        </div>
      )}
    </div>
  );
}

function TorchMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M9 3h6l-1 6h3L10 21l1.2-7H8L9 3z" />
    </svg>
  );
}

export function CameraPermission({ onClose, onManual, onRetry }: { onClose: () => void; onManual: () => void; onRetry: () => void }) {
  return (
    <div className="ov" data-testid="scan-permission">
      <div className="sheet scan-permission" role="dialog" aria-modal="true" aria-label="No tenemos acceso a la cámara" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-x scan-permission-x" aria-label="Cerrar" onClick={onClose}>×</button>
        <div className="scan-permission-icon"><CameraMark /></div>
        <h3>No tenemos acceso a la cámara</h3>
        <p className="sub">Para escanear, iManager necesita permiso. Mientras tanto podés escribir el IMEI o usar el lector.</p>
        <section>
          <p className="kicker">iPhone</p>
          <ol>
            <li><b>1</b> Abrí Ajustes › Apps › Safari › Cámara</li>
            <li><b>2</b> Elegí «Permitir» y volvé a iManager</li>
          </ol>
        </section>
        <section>
          <p className="kicker">iPhone · app instalada</p>
          <ol>
            <li><b>1</b> Abrí Ajustes › iManager › Cámara</li>
            <li><b>2</b> Elegí «Permitir» y volvé a iManager</li>
          </ol>
        </section>
        <section>
          <p className="kicker">Android y navegador</p>
          <ol>
            <li><b>3</b> Tocá el candado junto a la dirección › Permisos</li>
            <li><b>4</b> Activá Cámara</li>
          </ol>
        </section>
        <div className="sacts">
          <button type="button" className="btn2 s" onClick={onManual}>Escribir el IMEI</button>
          <button type="button" className="btn2 p" onClick={onRetry}>Reintentar</button>
        </div>
      </div>
    </div>
  );
}

function CameraMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4.5 8.5h2.8l1.3-2h6.8l1.3 2h2.8A1.5 1.5 0 0 1 21 10v8.2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.2V10a1.5 1.5 0 0 1 1.5-1.5z" />
      <circle cx="12" cy="13.4" r="3.1" />
    </svg>
  );
}
