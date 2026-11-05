import { useRef, useState } from "react";
import type { C06PreparePresentation } from "./public";
import { ExploreComparison, SalesComparisonIllustration } from "./ExploreModel";
import { ExploreRecord } from "./ExploreRecord";
import { ExploreStory } from "./ExploreStory";
import styles from "./commission.module.css";
import e from "./explore.module.css";

export function ExploreRecap(props: C06PreparePresentation) {
  const [revisiting, setRevisiting] = useState(false);
  const replay = useRef<HTMLButtonElement>(null);
  const evidence = useRef<HTMLDivElement>(null);
  function closeReplay() {
    setRevisiting(false);
    requestAnimationFrame(() => replay.current?.focus());
  }
  return (
    <section aria-label="Activity completion" className={e.completion}>
      <header className={e.recapHero}>
        <div>
          <span className={e.recapSeal} aria-hidden="true">
            ✓
          </span>
          <p className={styles.eyebrow}>Explore and Learn · Complete</p>
          <h3>
            One agreement.
            <br />
            <em>A different sales story.</em>
          </h3>
          <p>
            The salary stayed. The rate stayed.
            <br />
            <strong>Sales changed—and commission changed with it.</strong>
          </p>
        </div>
        <SalesComparisonIllustration />
      </header>
      <section
        className={e.recapEvidence}
        aria-label="The paired pay evidence"
        hidden={revisiting}
      >
        <h3>Same promises. Different total pay.</h3>
        <ExploreComparison projection={props.projection} />
      </section>
      <ExploreRecord projection={props.projection} />
      <section
        className={e.recapTransfer}
        aria-label="Take the reasoning forward"
      >
        <h3>
          Before asking “How much?”
          <br />
          <em>Follow what was promised.</em>
        </h3>
        <ol>
          <li>
            <span>01</span>
            <h4>Read the agreement</h4>
            <p>
              Keep the salary and commission rate fixed. Identify the sales
              record.
            </p>
          </li>
          <li>
            <span>02</span>
            <h4>Find the commission</h4>
            <p>Sales × rate. The percentage applies to sales—not salary.</p>
          </li>
          <li>
            <span>03</span>
            <h4>Combine the pay</h4>
            <p>
              Salary + commission. Keep the two payments’ meanings distinct.
            </p>
          </li>
        </ol>
      </section>
      <footer className={styles.actions}>
        <button
          ref={replay}
          className={styles.secondary}
          disabled={props.blocked}
          aria-expanded={revisiting}
          onClick={() => {
            if (revisiting) closeReplay();
            else {
              setRevisiting(true);
              requestAnimationFrame(() => evidence.current?.focus());
            }
          }}
        >
          {revisiting ? "Close the explanation" : "Revisit the explanation"}
        </button>
        {props.sessionContinuation && (
          <button
            className={styles.primary}
            disabled={props.blocked || !props.sessionContinuation.available}
            onClick={props.sessionContinuation.onContinue}
          >
            Back to Commission activities →
          </button>
        )}
      </footer>
      {revisiting && (
        <div ref={evidence} tabIndex={-1} className={e.recapReplay}>
          <ExploreStory {...props} stage={4} />
          <button className={styles.secondary} onClick={closeReplay}>
            Return to recap
          </button>
        </div>
      )}
    </section>
  );
}
