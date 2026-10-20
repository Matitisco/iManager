/** Short confirmation so a scan is obvious without looking at the screen. */
export function confirmScan() {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.08);
    oscillator.onended = () => {
      void audio.close();
    };
  } catch {
    // The read still counts when the browser blocks audio.
  }
  navigator.vibrate?.(40);
}
