import { useState } from "react";
import type { RefObject } from "react";
import type { C03PreparePresentation } from "./public";
import { ApplyEvidence } from "./ApplyEvidence";
import { ExploreGlyph } from "./ExploreGlyph";
import { pesos } from "./WorkEvidence";
import base from "./work-record.module.css";
import explore from "./explore.module.css";
import styles from "./apply.module.css";

export function ApplyRecap({
  projection,
  blocked,
  sessionContinuation,
  heading,
  titleId,
}: C03PreparePresentation & {
  heading: RefObject<HTMLHeadingElement | null>;
  titleId: string;
}) {
  const [revisiting, setRevisiting] = useState(false);
  const math = projection.mathematicalExplanation;
  const result = math?.overtimePay.resolution;
  const amount =
    result?.kind === "KNOWN" ? pesos(result.value.magnitude.toString()) : "";
  const rate = pesos(projection.workEvidence.rate.magnitude.toString());
  const multiplier = math?.multiplier.magnitude.toString();
  const hours = projection.workEvidence.hours.magnitude.toString();
  return (
    <>
      <header
        className={`${explore.recapHero} ${styles.recapHero}`}
        data-motion="conclusion"
      >
        <span className={base.completionSeal} aria-hidden="true">
          <ExploreGlyph name="check" />
        </span>
        <p className={base.eyebrow}>Apply · Bring the ideas together</p>
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          The condition led.
          <br />
          <em>The calculation followed.</em>
        </h2>
        <p className={styles.recapLead}>
          Ten extra hours on ordinary working days.
          <br />
          <strong>{amount} for those hours—not the whole month.</strong>
        </p>
      </header>
      <section
        className={styles.recapCalculation}
        aria-label="Your confirmed calculation"
      >
        <div>
          <p className={base.eyebrow}>Your calculation, confirmed</p>
          <h3>Each number has a job.</h3>
          <p>
            The rate tells us what one regular hour earns. The multiplier
            accounts for the kind of day. The hours tell us how much extra time
            to pay for.
          </p>
        </div>
        <div className={styles.workedEquation}>
          <div>
            <span>Hourly rate</span>
            <strong>{rate}</strong>
          </div>
          <b>×</b>
          <div>
            <span>Multiplier</span>
            <strong>{multiplier}</strong>
          </div>
          <b>×</b>
          <div>
            <span>Overtime hours</span>
            <strong>{hours}</strong>
          </div>
          <b>=</b>
          <div>
            <span>Overtime pay</span>
            <strong>{amount}</strong>
          </div>
        </div>
      </section>
      <section className={styles.takeaway}>
        <h3>Take the reasoning with you.</h3>
        <ol>
          <li>
            <span>01</span>
            <strong>Read the day.</strong>
            <p>
              James’s overtime falls on ordinary working days. That is why{" "}
              {multiplier} applies—not because he worked ten hours.
            </p>
          </li>
          <li>
            <span>02</span>
            <strong>Count all the extra hours.</strong>
            <p>
              The {hours} hours are a monthly total. You can use them together
              without inventing a daily schedule.
            </p>
          </li>
          <li>
            <span>03</span>
            <strong>Say what the amount means.</strong>
            <p>
              {amount} is overtime pay only. Regular earnings are not included.
            </p>
          </li>
        </ol>
        <p className={styles.transferNote}>
          If the kind of day changes, check the multiplier again. More hours
          change the amount; a different condition can change the rule.
        </p>
      </section>
      <div className={styles.revisit}>
        <button
          className={base.secondary}
          disabled={blocked}
          aria-expanded={revisiting}
          onClick={() => setRevisiting(!revisiting)}
        >
          <ExploreGlyph name="replay" />
          {revisiting ? "Close the work record" : "Revisit James’s work record"}
        </button>
        {revisiting && (
          <ApplyEvidence
            projection={projection}
            blocked={blocked}
            focus="all"
          />
        )}
      </div>
      <footer className={base.actions}>
        <p>Apply complete.</p>
        {sessionContinuation && (
          <button
            className={base.primary}
            disabled={blocked || !sessionContinuation.available}
            onClick={sessionContinuation.onContinue}
          >
            Return to Overtime Pay <ExploreGlyph name="next" />
          </button>
        )}
      </footer>
    </>
  );
}
