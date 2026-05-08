export function useVibrate() {
  const vibrate = (pattern: number | number[] = 50) => {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Vibration not supported or blocked
      }
    }
  };

  const vibrateError = () => vibrate([50, 50, 50]);
  const vibrateSuccess = () => vibrate(100);
  const vibrateTap = () => vibrate(10);

  return { vibrate, vibrateError, vibrateSuccess, vibrateTap };
}
