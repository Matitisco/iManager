import { devices, expect, test } from '@playwright/test';
import { bootStore, openEquipos, registerScanQa, useBarcode } from './qa-scan-1910';

const { defaultBrowserType: _browser, ...android } = devices['Pixel 7'];

test.use({
  ...android,
  browserName: 'chromium',
  viewport: { width: 390, height: 844 },
});

registerScanQa(390);

test('switches exclusive rear lenses and reads Code128 without darkening the preview', async ({ page, request }, info) => {
  await bootStore(page, request, info, 'rear-lens');
  await openEquipos(page);
  await page.evaluate(() => {
    const media = navigator.mediaDevices;
    const original = media.getUserMedia.bind(media);
    const requests: string[] = [];
    (window as Window & { __lensRequests?: string[] }).__lensRequests = requests;
    let active = false;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      enumerateDevices: async () => [
        { kind: 'videoinput', deviceId: 'main', label: 'camera2 0, facing back' },
        { kind: 'videoinput', deviceId: 'alternate', label: 'camera2 2, facing back' },
        { kind: 'videoinput', deviceId: 'front', label: 'camera2 1, facing front' },
      ],
      getUserMedia: async (constraints: MediaStreamConstraints) => {
        if (active) throw new DOMException('one camera at a time', 'NotReadableError');
        const device = (constraints.video as MediaTrackConstraints).deviceId as { exact: string } | undefined;
        const id = device?.exact ?? 'main';
        requests.push(id);
        const stream = await original(constraints);
        active = true;
        const track = stream.getVideoTracks()[0]!;
        const settings = track.getSettings.bind(track);
        track.getSettings = () => ({ ...settings(), deviceId: id });
        const stop = track.stop.bind(track);
        track.stop = () => { active = false; stop(); };
        return stream;
      },
    } });
  });
  await useBarcode(page, 'qr-short');
  await page.getByRole('button', { name: 'Registrar equipo' }).first().click();
  await page.getByRole('button', { name: 'Escanear con la cámara' }).click();
  const viewer = page.getByTestId('scan-viewer');
  await expect(viewer.locator('video')).toHaveCSS('opacity', '1');
  const change = viewer.getByRole('button', { name: 'Cambiar cámara' });
  await expect(change).toBeEnabled();
  await change.click();
  await expect(change).toBeEnabled();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lensRequests?: string[] }).__lensRequests)).toEqual(['main', 'alternate']);
  await page.screenshot({ path: 'docs/pr-shots/440-camera-android.png', animations: 'disabled' });
  await useBarcode(page, 'box');
  await expect(viewer.getByText('IMEI leído')).toBeVisible({ timeout: 15_000 });
});
