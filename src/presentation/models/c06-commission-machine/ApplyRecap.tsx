import { useRef, useState } from "react";
import type { C06PreparePresentation } from "./public";
import { ApplyMachine } from "./ApplyEvidence";
import { ApplyRecord } from "./ApplyRecord";
import { ApplyGuidance } from "./ApplyGuidance";
import styles from "./commission.module.css";
import a from "./apply.module.css";

export function ApplyRecap(props: C06PreparePresentation) {
  const [revisit, setRevisit] = useState(false);
  const invoker = useRef<HTMLButtonElement>(null);
  return (
    <section className={a.recap} aria-label="Activity completion">
      <header className={a.recapHero}>
        <span className={a.seal} aria-hidden="true">
          ✓
        </span>
        <p className={styles.eyebrow}>Apply finished · Straight commission</p>
        <h3>
          The sale,
          <br />
          <em>in perspective.</em>
        </h3>
        <p>
          Read what was promised.
          <br />
          <strong>Keep the sale and the payment distinct.</strong>
        </p>
      </header>
      <ApplyRecord projection={props.projection} />
      <section
        className={a.recapRelationship}
        aria-label="The resolved commission relationship"
      >
        <h3>One percentage. One sales base. One commission.</h3>
        <ApplyMachine projection={props.projection} />
        <p>
          The agent’s commission is ₱100,000. The ₱2,000,000 property price
          supplies the reference; it does not become an additional payment.
        </p>
      </section>
      <section className={a.transfer}>
        <h3>Take the reasoning with you.</h3>
        <ol>
          <li>
            <span>01</span>
            <h4>Read the promise.</h4>
            <p>
              The arrangement decides which pay components belong. Include a
              salary only when the agreement promises one.
            </p>
          </li>
          <li>
            <span>02</span>
            <h4>Keep the reference.</h4>
            <p>
              Apply the percentage to the full sale. A different sale changes
              the base; a different agreement can change the rule.
            </p>
          </li>
          <li>
            <span>03</span>
            <h4>Name the result.</h4>
            <p>
              Your result is commission earned. Check its units and meaning
              before calling it pay, proceeds, or a total.
            </p>
          </li>
        </ol>
      </section>
      <div className={a.revisit}>
        <button
          ref={invoker}
          className={styles.secondary}
          aria-expanded={revisit}
          disabled={props.blocked}
          onClick={() => setRevisit(!revisit)}
        >
          {revisit
            ? "Close relationship review"
            : "Revisit the commission relationship"}
        </button>
        {revisit && (
          <>
            <ApplyGuidance projection={props.projection} help />
            <button
              className={styles.textButton}
              onClick={() => {
                setRevisit(false);
                requestAnimationFrame(() => invoker.current?.focus());
              }}
            >
              Return to my recap
            </button>
          </>
        )}
      </div>
      <footer className={a.panelNav}>
        <p>Apply complete. Your claim is recorded.</p>
        {props.sessionContinuation?.available && (
          <button
            className={styles.primary}
            disabled={props.blocked}
            onClick={props.sessionContinuation.onContinue}
          >
            Back to Commission activities
          </button>
        )}
      </footer>
    </section>
  );
}
