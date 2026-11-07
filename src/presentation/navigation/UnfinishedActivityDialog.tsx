import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useSound } from "@/presentation/audio/public";
import { UnfinishedWorkArt } from "./UnfinishedWorkArt";
import type { ArtWorld } from "./UnfinishedWorkArt";
import styles from "./unfinished.module.css";

export type ActivityName = Readonly<{
  competency: string | null;
  activity: string;
}>;

/** The unfinished-activity decision. The three choices are the existing
 * Session decisions, unchanged: return to the unfinished activity, abandon it
 * and open the selected one, or (as the shell's Back already does) cancel the
 * pending switch and stay where the learner is. */
export function UnfinishedActivityDialog({
  unfinished,
  selected,
  world,
  canReturn,
  canAbandon,
  canCancel,
  onReturn,
  onAbandon,
  onCancel,
  notice,
}: {
  unfinished: ActivityName | null;
  selected: ActivityName | null;
  world: ArtWorld;
  canReturn: boolean;
  canAbandon: boolean;
  canCancel: boolean;
  onReturn: () => void;
  onAbandon: () => void;
  onCancel: () => void;
  notice: string | null;
}) {
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const bodyId = useId();
  const sound = useSound();
  // Staying put closes the decision; Return and Abandon are heard as the
  // navigation they cause.
  const cancel = () => {
    sound.play("ui.close");
    onCancel();
  };

  // Safe default focus: the progress-preserving choice, never abandonment.
  useEffect(() => {
    const button = primary.current;
    (button && !button.disabled ? button : card.current)?.focus();
    sound.play("ui.open");
  }, [sound]);

  // A choice that the Session reopens (for example after a failed clear) can
  // be made again; until then one press is one request.
  useEffect(() => {
    busy.current = false;
    setPending(false);
  }, [canReturn, canAbandon, canCancel]);

  const once = (action: () => void) => () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    action();
  };

  const unfinishedName = unfinished?.activity ?? "your unfinished activity";
  const selectedName = selected?.activity ?? "the selected activity";
  const style = {
    "--world": world.world,
    "--world-deep": world.deep,
    "--world-soft": world.soft,
  } as CSSProperties;

  return (
    <div className={styles.scrim} data-switch-dialog="">
      <div
        ref={card}
        className={styles.card}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-heading"
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (canCancel) once(cancel)();
            return;
          }
          if (event.key !== "Tab") return;
          const items = [
            ...(card.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) ?? []),
          ];
          if (!items.length) {
            event.preventDefault();
            return;
          }
          const first = items[0]!;
          const last = items[items.length - 1]!;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          } else if (!card.current?.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className={styles.art}>
          <UnfinishedWorkArt world={world} />
        </div>
        <div className={styles.content}>
          <div className={styles.text}>
            <p className={styles.eyebrow}>Unfinished activity</p>
            <h2 id="switch-heading" className={styles.heading}>
              {unfinished
                ? `${unfinished.activity} isn’t finished yet`
                : "You have an unfinished activity"}
            </h2>
            <div id={bodyId} className={styles.body}>
              <p>
                You chose to open <strong>{selectedName}</strong>. You can go
                back to <strong>{unfinishedName}</strong> and carry on where you
                left off, or abandon it and open {selectedName}.
              </p>
              <p className={styles.consequence}>
                Abandoning clears the work saved in {unfinishedName}. If you
                open it again later, it starts from the beginning.
              </p>
            </div>
            {(unfinished || selected) && (
              <dl className={styles.pair}>
                {unfinished && (
                  <div data-kind="unfinished">
                    <dt>Unfinished</dt>
                    <dd>
                      {unfinished.competency && (
                        <span>{unfinished.competency} · </span>
                      )}
                      {unfinished.activity}
                    </dd>
                  </div>
                )}
                {selected && (
                  <div data-kind="selected">
                    <dt>You selected</dt>
                    <dd>
                      {selected.competency && (
                        <span>{selected.competency} · </span>
                      )}
                      {selected.activity}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {notice && (
              <p role="status" className={styles.notice}>
                {notice}
              </p>
            )}
          </div>
          <div className={styles.actions}>
            <button
              ref={primary}
              type="button"
              className={styles.primary}
              data-paid-nav=""
              disabled={pending || !canReturn}
              onClick={once(onReturn)}
            >
              Return to unfinished activity
            </button>
            <button
              type="button"
              className={styles.secondary}
              data-paid-nav=""
              disabled={pending || !canAbandon}
              onClick={once(onAbandon)}
            >
              Abandon and open selected activity
            </button>
            <button
              type="button"
              className={styles.tertiary}
              data-paid-nav=""
              disabled={pending || !canCancel}
              onClick={once(cancel)}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
