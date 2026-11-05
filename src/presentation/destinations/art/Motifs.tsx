import { useId } from "react";

/** Hand-drawn wave underline shared by the navigation surfaces. */
export function WaveRule({
  className,
}: Readonly<{ className?: string | undefined }>) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 7 C 13 1, 23 1, 33 7 S 53 13, 63 7 S 83 1, 93 7 S 113 13, 123 7 S 143 1, 157 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Circular stamp with lettering around the edge. */
export function StampBadge({
  text,
  className,
  glyph = "spark",
}: Readonly<{
  text: string;
  className?: string | undefined;
  glyph?: "spark" | "check";
}>) {
  const id = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path
          id={`${id}-ring`}
          d="M60 60 m-42 0 a42 42 0 1 1 84 0 a42 42 0 1 1 -84 0"
        />
      </defs>
      <circle cx="60" cy="60" r="57" fill="currentColor" />
      <circle
        cx="60"
        cy="60"
        r="30"
        fill="none"
        stroke="var(--stamp-ink, #263128)"
        strokeWidth="1.5"
        strokeDasharray="2 4"
      />
      <text
        fill="var(--stamp-ink, #263128)"
        fontFamily="Lexend, sans-serif"
        fontSize="10.5"
        fontWeight="600"
        letterSpacing="2.6"
      >
        <textPath
          href={`#${id}-ring`}
          textLength="262"
          lengthAdjust="spacingAndGlyphs"
        >
          {text}
        </textPath>
      </text>
      {glyph === "spark" ? (
        <path
          d="M60 44 L64 56 L76 60 L64 64 L60 76 L56 64 L44 60 L56 56 Z"
          fill="var(--stamp-ink, #263128)"
        />
      ) : (
        <path
          d="M47 61 l9 9 18 -20"
          fill="none"
          stroke="var(--stamp-ink, #263128)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
