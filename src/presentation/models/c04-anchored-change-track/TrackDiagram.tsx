import styles from "./anchored-change-track.module.css";

/** Fixed relational scenes, never a currency scale or a second math provider. */
export function TrackDiagram({
  scene,
  showChange,
  showRelative,
}: {
  scene: "equal" | "increase" | "decrease" | "withheld";
  showChange: boolean;
  showRelative: boolean;
}) {
  const marker = {
    equal: "180",
    increase: "330",
    decrease: "75",
    withheld: "180",
  }[scene];
  return (
    <svg
      className={styles.diagram}
      viewBox="0 0 420 225"
      aria-hidden="true"
      focusable="false"
      data-scene={scene}
    >
      <path d="M30 80 H390" className={styles.track} />
      {showChange && scene === "increase" && (
        <path
          d="M180 80 H330 M320 70 L330 80 L320 90"
          className={styles.span}
        />
      )}
      {showChange && scene === "decrease" && (
        <path d="M180 80 H75 M85 70 L75 80 L85 90" className={styles.span} />
      )}
      <path d="M180 45 V110" className={styles.anchor} />
      <text x="180" y="30" textAnchor="middle">
        Original · Reference Basis
      </text>
      {scene !== "withheld" && (
        <>
          <circle cx={marker} cy="80" r="9" className={styles.marker} />
          <text x={marker} y="140" textAnchor="middle">
            New
          </text>
        </>
      )}
      {showChange && (
        <text x="210" y="170" textAnchor="middle">
          Change Span
        </text>
      )}
      {showRelative && (
        <>
          <path
            d="M210 178 V195 M205 190 L210 195 L215 190"
            className={styles.span}
          />
          <text x="210" y="218" textAnchor="middle">
            Relative to Original
          </text>
        </>
      )}
    </svg>
  );
}
