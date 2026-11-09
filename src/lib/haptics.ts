/** Tiny haptic tick on Android; silently ignored elsewhere (iOS Safari has no vibrate). */
export function tick(ms = 10) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
