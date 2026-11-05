import e from "./explore.module.css";

/** Opacity follows the lesson clock, so pausing and seeking also control the fade. */
export function ExploreNarration({
  text,
  elapsed,
  duration,
  immediate,
}: {
  text: string;
  elapsed: number;
  duration: number;
  immediate: boolean;
}) {
  if (immediate) return <p>{text}</p>;
  const phrases = text.split(
    /(?<=[.!?;])\s+|(?<=,)\s+(?=(?:then|alongside|and|so)\b)/u,
  );
  // Finish the entrance early enough to leave a generous fully readable hold.
  const revealWindow = duration * 0.55;
  let preceding = 0;
  return (
    <p>
      <span className={e.srOnly}>{text}</span>
      <span aria-hidden="true">
        {phrases.map((phrase, index) => {
          const start = (preceding / text.length) * revealWindow;
          preceding += phrase.length + 1;
          const fade = Math.max(0, Math.min(1, (elapsed - start) / 650));
          const opacity = fade * fade * (3 - 2 * fade);
          return (
            <span key={index} style={{ opacity }}>
              {phrase}
              {index < phrases.length - 1 ? " " : ""}
            </span>
          );
        })}
      </span>
    </p>
  );
}