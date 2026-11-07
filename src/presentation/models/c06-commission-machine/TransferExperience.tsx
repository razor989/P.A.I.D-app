import { useEffect, useId, useRef, useState } from "react";
import type { C06PreparePresentation } from "./public";
import { TransferEvidence, StoreIllustration } from "./TransferEvidence";
import { TransferResponse } from "./TransferResponse";
import { TransferRecord } from "./TransferRecord";
import { TransferTeaching } from "./TransferTeaching";
import { TransferCompletion } from "./TransferCompletion";
import { TransferGuidance } from "./TransferGuidance";
import { TransferDiagram } from "./TransferDiagram";
import { useWorkRecordMotion } from "./use-commission-motion";
import base from "./commission.module.css";
import t from "./transfer.module.css";
import { LessonMasthead } from "../../navigation/public";
import { revealHeading } from "../../activity/public";

/** Real Session-owned Actor; confirmed current work and delivered teaching precede Finish. */
export function TransferExperience(props: C06PreparePresentation) {
  const { frame } = props.projection;
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const teaching = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const invoker = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLElement>(null);
  const [panel, setPanel] = useState(0);
  const support = Boolean(frame.review);
  const disabled = props.blocked || support;
  useWorkRecordMotion(surface, `${frame.stateId}/${panel}`, disabled);
  const { onPresented } = props;
  const revealed = useRef("");
  useEffect(() => {
    if (props.blocked || support) return;
    // A new step's heading lands below the lesson nav; returning from help
    // only restores focus, without moving the page. The intro opens at the
    // top with its masthead (the shell resets scroll); the completion recap
    // brings itself into view.
    if (
      revealed.current === frame.stateId ||
      frame.stateId === "ENTRY" ||
      frame.stateId === "COMPLETE"
    )
      heading.current?.focus({ preventScroll: true });
    else
      revealHeading(
        heading.current,
        typeof matchMedia === "function" &&
          matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
    revealed.current = frame.stateId;
  }, [frame.stateId, props.blocked, support]);
  useEffect(() => {
    if (support && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    if (!support && dialog.current?.open) {
      dialog.current.close();
      invoker.current?.focus();
    }
  }, [support]);
  useEffect(() => {
    if (disabled) return;
    if (frame.feedbackState && feedback.current?.isConnected)
      onPresented("feedback", feedback.current);
    if (
      frame.stateId === "POST_CONFIRMATION_EXPLANATION" &&
      teaching.current?.isConnected
    )
      onPresented("teaching", teaching.current);
  }, [disabled, frame, onPresented]);
  if (frame.activityId !== "C06-A04")
    throw new TypeError("TransferExperience requires C06-A04");
  const can = (intent: string) =>
    !disabled && frame.allowedLearnerIntents.some((item) => item === intent);
  const entry = frame.stateId === "ENTRY";
  const complete = frame.stateId === "COMPLETE";
  const explaining = frame.stateId === "POST_CONFIRMATION_EXPLANATION";
  const checked =
    frame.stateId === "CONFIRMATION" || frame.stateId === "RECONSIDERATION";
  return (
    <article
      ref={surface}
      className={`${base.workshop} ${t.workshop}`}
      aria-labelledby={id}
      data-c06-track="C06-A04"
    >
      <LessonMasthead>
        <header className={base.masthead}>
          <span className={base.brand}>p.a.i.d.</span>
          <span className={base.mastLabel}>The money &amp; math workshop</span>
          <span className={base.edition}>Grade 11</span>
        </header>
      </LessonMasthead>
      <div className={`${base.sheet} ${t.sheet}`}>
        <h2
          id={id}
          ref={heading}
          tabIndex={-1}
          className={complete || entry ? t.visuallyHidden : undefined}
        >
          {entry ? (
            <>
              A month of sales.
              <br />
              <em>What belongs in Lina’s pay?</em>
            </>
          ) : explaining ? (
            <>
              Two results.
              <br />
              <em>Know what each carries.</em>
            </>
          ) : (
            <>
              Read the agreement.
              <br />
              <em>Make your own connection.</em>
            </>
          )}
        </h2>
        {entry ? (
          <>
            <section className={t.opening} data-motion="scene">
              <div className={t.entryCopy}>
                <p className={t.tag}>LINA · THE JUNE PAY RECORD</p>
                <h2>
                  A familiar relationship.
                  <br />
                  <em>A new pay record.</em>
                </h2>
                <p className={t.entryLead}>
                  You have compared agreements, followed changing sales and
                  calculated straight commission. Now bring that reasoning to
                  Lina’s June pay.
                </p>
                <p
                  className={t.entryScenario}
                  data-content-id="c06/S04/scenario"
                >
                  {
                    frame.contentReferences.find(
                      (item) => item.id === "c06/S04/scenario",
                    )?.text
                  }
                </p>
                <button
                  className={base.primary}
                  disabled={!can("CONTINUE")}
                  onClick={() => props.onAction("CONTINUE")}
                >
                  Read Lina’s June record →
                </button>
              </div>
              <div className={t.entryArt}>
                <StoreIllustration />
                <div className={t.recordStamp}>
                  <span>JUNE / SALES RECORD</span>
                  <strong>₱120,000</strong>
                  <small>One month. An agreement to read.</small>
                </div>
              </div>
            </section>
            <aside className={t.entryBottom}>
              <span aria-hidden="true">↗</span>
              <p>
                <strong>
                  Read the promise. Trace the percentage. Name the pay.
                </strong>
                <br />A relationship reference is available. Apply it to Lina’s
                record; your three responses are checked together.
              </p>
            </aside>
          </>
        ) : complete ? (
          <TransferCompletion {...props} />
        ) : explaining ? (
          <>
            <div ref={teaching}>
              <TransferTeaching
                projection={props.projection}
                blocked={disabled}
              />
            </div>
            <footer className={t.actions}>
              <p>
                Your current response is confirmed. Follow what each result
                means before finishing.
              </p>
              <button
                className={base.primary}
                disabled={!can("FINISH_ACTIVITY")}
                onClick={() => props.onAction("FINISH_ACTIVITY")}
              >
                See my June recap →
              </button>
            </footer>
          </>
        ) : checked ? (
          <>
            {frame.feedbackState && (
              <div
                ref={feedback}
                role="status"
                className={t.feedback}
                data-outcome={frame.feedbackState.outcome}
              >
                <h3>
                  {frame.feedbackState.outcome === "CONFIRMED"
                    ? "Your June calculation holds together."
                    : "Look again at how the pay connects."}
                </h3>
                <p data-content-id={frame.feedbackState.content.id}>
                  {frame.feedbackState.content.text}
                </p>
              </div>
            )}
            {frame.feedbackState?.outcome === "RECONSIDERATION" ? (
              <TransferGuidance
                {...props}
                blocked={disabled}
                onRevise={(target) => {
                  setPanel(target);
                  props.onAction("REVISE");
                }}
              />
            ) : (
              <div className={t.workspace}>
                <TransferEvidence
                  projection={props.projection}
                  blocked={disabled}
                />
                <div>
                  <TransferRecord projection={props.projection} />
                  <p className={t.prompt}>
                    Your arrangement and both amounts hold together. Now follow
                    the worked connections and identify which result can carry
                    forward.
                  </p>
                </div>
              </div>
            )}
            <footer className={t.actions}>
              {can("REVISE") &&
                frame.feedbackState?.outcome === "CONFIRMED" && (
                  <button
                    className={base.secondary}
                    onClick={() => props.onAction("REVISE")}
                  >
                    Revise my June calculation
                  </button>
                )}
              {frame.feedbackState?.outcome === "CONFIRMED" && (
                <button
                  className={base.primary}
                  disabled={!can("CONTINUE")}
                  onClick={() => props.onAction("CONTINUE")}
                >
                  Follow the June pay relationship →
                </button>
              )}
            </footer>
          </>
        ) : (
          <>
            <p className={t.lead}>
              Identify the arrangement. Determine commission. Then determine the
              total.
            </p>
            <div className={t.workspace}>
              <TransferEvidence
                projection={props.projection}
                focus={["salary", "rate", "total"][panel] ?? "all"}
                blocked={disabled}
              />
              <TransferResponse
                {...props}
                blocked={disabled}
                panel={panel}
                onPanel={setPanel}
              />
            </div>
          </>
        )}
        {!entry && !complete && (
          <div className={t.help}>
            <button
              ref={invoker}
              className={base.textButton}
              disabled={!can("OPEN_SUPPORT")}
              onClick={props.onHelp}
            >
              Review the pay relationship
            </button>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className={t.dialog}
        aria-label="Review the pay relationship"
        onCancel={(event) => {
          event.preventDefault();
          props.onCloseHelp();
        }}
      >
        {support && (
          <>
            <p className={base.eyebrow}>A RELATIONSHIP TO REVISIT</p>
            <h2>Which amount does each job?</h2>
            <TransferDiagram reference blocked={props.blocked} />
            <p>
              Begin with what was sold and the rate in the agreement. The salary
              is a separate promise; it is not the reference for the percentage.
            </p>
            <p>
              {frame.review?.relationships.map((item) => item.text).join(" ")}
            </p>
            <p>
              No answer is filled in for you. Return to your record and decide
              which amounts belong.
            </p>
            <button
              className={base.primary}
              disabled={props.blocked}
              onClick={props.onCloseHelp}
            >
              Return to my June calculation
            </button>
          </>
        )}
      </dialog>
    </article>
  );
}
