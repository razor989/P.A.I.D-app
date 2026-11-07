/** The learner's sound-effects preference: on unless they switched it off.
 * Storage failure (private mode, quota, a blocked WebView store) keeps the
 * choice for this session only; it never surfaces as an error. */
export function createBrowserSoundPreferenceStore() {
  const key = "paid.preferences.sound.v1";
  let memory: boolean | null = null;
  return Object.freeze({
    load(): boolean | null {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return memory;
        const value: unknown = JSON.parse(raw);
        return typeof value === "object" &&
          value !== null &&
          "enabled" in value &&
          typeof value.enabled === "boolean"
          ? value.enabled
          : memory;
      } catch {
        return memory;
      }
    },
    save(enabled: boolean) {
      memory = enabled;
      try {
        window.localStorage.setItem(key, JSON.stringify({ enabled }));
      } catch {
        /* session-only preference */
      }
    },
  });
}
