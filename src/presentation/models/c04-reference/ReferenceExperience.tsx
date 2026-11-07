import { useEffect, useRef } from "react";
import type { C04Presentation } from "../c04-anchored-change-track/public";
import { createReferenceRenderer } from "./reference-renderer";
import "./styles.css";
import "./atmosphere.css";
import "./refinement.css";
import "./instructional-enhancement.css";
import { LessonMasthead } from "../../navigation/public";
import { useInspectionSound, useSound } from "../../audio/public";

/** React owns route/lifecycle; the source-preserved renderer owns only reading/view state. */
export function ReferenceExperience(props: C04Presentation) {
  const host = useRef<HTMLDivElement>(null);
  const announcer = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof createReferenceRenderer> | null>(
    null,
  );
  // The renderer lives for the mount; the engine is stable for the page.
  const sound = useSound();
  const play = useRef(sound);
  play.current = sound;
  const inspectionSound = useInspectionSound();
  const voice = useRef(inspectionSound);
  voice.current = inspectionSound;
  useEffect(() => {
    if (!host.current) return;
    const current = createReferenceRenderer(
      host.current,
      (text) => {
        if (announcer.current) announcer.current.textContent = text;
      },
      {
        cue: (cue) => play.current.play(cue),
        inspection: (event, detail) => voice.current(event, detail),
      },
    );
    renderer.current = current;
    return () => {
      current.dispose();
      renderer.current = null;
    };
  }, []);
  useEffect(() => {
    renderer.current?.update(props);
  }, [props]);
  return (
    <section className="c04-reference" data-c04-track="C04-A02">
      <LessonMasthead>
        <header className="masthead">
          <span className="brand">p.a.i.d.</span>
          <span className="mast-label">The money &amp; math workshop</span>
          <span className="edition">Grade 11</span>
        </header>
      </LessonMasthead>
      <div className="reference-main" ref={host} />
      {props.frame.stateId === "COMPLETE" && props.canContinueSession && (
        <button
          type="button"
          disabled={props.blocked}
          onClick={props.onContinueSession}
        >
          Continue completed activity
        </button>
      )}
      <footer className="site-footer">
        Explore &amp; learn · Percentage change
      </footer>
      <div
        ref={announcer}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />
    </section>
  );
}
