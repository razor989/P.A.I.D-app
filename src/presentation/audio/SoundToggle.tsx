import { useSound, useSoundEnabled } from "./SoundProvider";
import styles from "./audio.module.css";

type DataAttributes = { [key: `data-${string}`]: string | undefined };

/**
 * The learner's sound-effects switch. Audio is optional and supplementary;
 * where the platform cannot play sound the switch is not offered at all.
 */
export function SoundToggle({
  className,
  inert,
  ...data
}: Readonly<
  {
    className?: string | undefined;
    inert?: boolean | undefined;
  } & DataAttributes
>) {
  const engine = useSound();
  const enabled = useSoundEnabled();
  if (!engine.supported) return null;
  return (
    <button
      type="button"
      className={[styles.toggle, className].filter(Boolean).join(" ")}
      aria-pressed={enabled}
      aria-label="Sound effects"
      title={enabled ? "Sound effects on" : "Sound effects off"}
      data-sound-toggle=""
      data-paid-nav=""
      inert={inert}
      {...data}
      onClick={() => {
        engine.setEnabled(!enabled);
        // Switching on confirms itself; switching off is simply silence.
        if (!enabled) engine.play("ui.toggle.on");
      }}
    >
      <svg
        className={styles.glyph}
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
      >
        <path className={styles.speaker} d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" />
        {enabled ? (
          <>
            <path d="M13.2 7.4a3.6 3.6 0 0 1 0 5.2" />
            <path d="M15.4 5.2a6.8 6.8 0 0 1 0 9.6" />
          </>
        ) : (
          <path d="m13.5 7.5 5 5m0-5-5 5" />
        )}
      </svg>
    </button>
  );
}
