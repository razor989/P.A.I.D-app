import { useEffect, useRef, useState } from "react";
import { useCueOnEnter } from "../../audio/public";
import type { C03PreparePresentation } from "./public";
import { TransferModel } from "./TransferModel";
import { TransferSynthesis } from "./TransferSynthesis";
import { TransferInvitation } from "./TransferInvitation";
import { TransferFinale } from "./TransferFinale";
import { ExploreGlyph } from "./ExploreGlyph";
import { pesos } from "./WorkEvidence";
import base from "./work-record.module.css";
import explore from "./explore.module.css";
import styles from "./transfer.module.css";

/** Three presentation views of genuine COMPLETE, never new completion evidence. */
export function TransferCompletion(
  props: C03PreparePresentation & { titleId: string },
) {
  const [view, setView] = useState<"recap" | "synthesis" | "finale">("recap");
  const [inspect, setInspect] = useState(false);
  useCueOnEnter(inspect, "model.reveal");
  const heading = useRef<HTMLHeadingElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (view === "finale" || props.blocked || media.matches) return;
    const animation = surface.current?.animate?.(
      [
        { opacity: 0, transform: "translateY(14px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 600, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    const cancel = () => animation?.cancel();
    media.addEventListener("change", cancel);
    return () => {
      cancel();
      media.removeEventListener("change", cancel);
    };
  }, [view, props.blocked]);
  useEffect(() => {
    if (!props.blocked) {
      heading.current?.focus({ preventScroll: true });
      surface.current?.scrollIntoView({ block: "start" });
    }
  }, [view, props.blocked]);
  const math = props.projection.mathematicalExplanation;
  const result = math?.overtimePay.resolution;
  if (
    props.projection.frame.stateId !== "COMPLETE" ||
    !math ||
    result?.kind !== "KNOWN"
  )
    return null;
  const returnAction = props.sessionContinuation;
  const amount = pesos(result.value.magnitude.toString());
  return (
    <div
      ref={surface}
      className={styles.completion}
      data-transfer-completion={view}
      data-blocked={props.blocked || undefined}
    >
      {view === "finale" ? (
        <div className={styles.storyScreen}>
          <div className={styles.storyScreenTransition} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <TransferFinale
            blocked={props.blocked}
            titleId={props.titleId}
            projection={props.projection}
          />
        </div>
      ) : (
        <>
          <header className={`${explore.recapHero} ${styles.recapHero}`}>
            <span className={base.completionSeal} aria-hidden="true">
              <ExploreGlyph name="check" />
            </span>
            <p className={base.eyebrow}>
              {view === "recap"
                ? "Check and Transfer · Your recap"
                : "Overtime pay · Ideas together"}
            </p>
            <h2 id={props.titleId} ref={heading} tabIndex={-1}>
              {view === "recap" ? (
                <>
                  A new condition.
                  <br />
                  <em>A connected answer.</em>
                </>
              ) : (
                <>
                  Different days.
                  <br />
                  <em>The same way of thinking.</em>
                </>
              )}
            </h2>
            <p>
              {view === "recap" ? (
                <>
                  Mara’s three extra hours earn <strong>{amount}</strong>.<br />
                  The condition came first. The calculation followed.
                </>
              ) : (
                <>
                  Read the condition. Apply its rule.
                  <br />
                  <strong>
                    Then let the rate and extra hours do their jobs.
                  </strong>
                </>
              )}
            </p>
          </header>
          {view === "recap" ? (
            <>
              <section
                className={styles.workedRecap}
                aria-label="Mara’s confirmed reasoning"
              >
                <div>
                  <p className={base.eyebrow}>Your response · Confirmed</p>
                  <h3>Three answers. One line of reasoning.</h3>
                  <dl>
                    <div>
                      <dt>Overtime condition</dt>
                      <dd>{math.condition}</dd>
                    </div>
                    <div>
                      <dt>Applicable multiplier</dt>
                      <dd>{math.multiplier.magnitude.toString()}</dd>
                    </div>
                    <div>
                      <dt>Overtime pay</dt>
                      <dd>{amount}</dd>
                    </div>
                  </dl>
                </div>
                <div className={styles.workedReading}>
                  <p className={styles.equation}>
                    {pesos(
                      props.projection.workEvidence.rate.magnitude.toString(),
                    )}{" "}
                    × {math.multiplier.magnitude.toString()} × 3{" "}
                    <strong>= {amount}</strong>
                  </p>
                  <p>
                    The regular holiday establishes the rule. The multiplier
                    changes what each overtime hour earns, not how many hours
                    Mara worked.
                  </p>
                  <p>
                    <strong>
                      {amount} covers the three overtime hours only.
                    </strong>{" "}
                    The first eight hours’ earnings, gross income and net pay
                    are not part of this amount.
                  </p>
                </div>
                <div className={styles.recapRecord}>
                  <button
                    className={base.secondary}
                    disabled={props.blocked}
                    aria-expanded={inspect}
                    onClick={() => setInspect(!inspect)}
                  >
                    <ExploreGlyph name="replay" />
                    {inspect
                      ? "Close Mara’s record"
                      : "Revisit Mara’s work record"}
                  </button>
                  {inspect && (
                    <TransferModel
                      projection={props.projection}
                      blocked={props.blocked}
                      focus="all"
                    />
                  )}
                </div>
              </section>
              <p
                className={styles.completionCopy}
                data-content-id="c03/S04/completion"
              >
                {
                  props.projection.frame.contentReferences.find(
                    (r) => r.id === "c03/S04/completion",
                  )?.text
                }
              </p>
            </>
          ) : (
            <TransferSynthesis
              projection={props.projection}
              blocked={props.blocked}
            />
          )}
        </>
      )}
      {view === "synthesis" && (
        <TransferInvitation
          blocked={props.blocked}
          onOpen={() => setView("finale")}
        />
      )}
      <footer className={`${base.actions} ${styles.completionActions}`}>
        <div className={base.actionGroup}>
          {view !== "recap" && (
            <button
              className={base.textButton}
              disabled={props.blocked}
              onClick={() => setView(view === "finale" ? "synthesis" : "recap")}
            >
              <ExploreGlyph name="previous" />
              {view === "finale"
                ? "Back to ideas together"
                : "Back to my recap"}
            </button>
          )}
          {returnAction && (
            <button
              className={base.textButton}
              disabled={props.blocked || !returnAction.available}
              onClick={returnAction.onContinue}
            >
              Return to Overtime Pay
            </button>
          )}
        </div>
        {view === "recap" && (
          <button
            className={base.primary}
            disabled={props.blocked}
            onClick={() => setView(view === "recap" ? "synthesis" : "finale")}
          >
            {view === "recap"
              ? "Overtime Pay: Ideas Together"
              : "Beyond the work record"}
            <ExploreGlyph name="next" />
          </button>
        )}
      </footer>
    </div>
  );
}
