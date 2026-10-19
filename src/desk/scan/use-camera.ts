import { useEffect, useState } from 'react';

export function useCameraAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    let active = true;
    media.enumerateDevices()
      .then((devices) => {
        if (active) setAvailable(devices.some((device) => device.kind === 'videoinput'));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return available;
}
