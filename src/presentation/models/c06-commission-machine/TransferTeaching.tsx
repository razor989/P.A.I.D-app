import { useState } from "react";
import type { C06PreparePresentation } from "./public";
import { TransferEvidence } from "./TransferEvidence";
import base from "./commission.module.css";
import t from "./transfer.module.css";

/** All required source teaching is rendered together; tabs only deepen its reading. */
export function TransferTeaching({
  projection,
  blocked,
}: Pick<C06PreparePresentation, "projection" | "blocked">) {
  const [link, setLink] = useState(0);
  const { frame } = projection;
  const copy = (role: string) =>
    frame.contentReferences.find((item) => item.id === `c06/S04/${role}`);
  const links = [
    [
      "Commission",
      "The percentage belongs to sales.",
      "Lina’s rate applies to her June sales. The base salary is not part of the sales base, and sales does not become another pay component.",
    ],
    [
      "Total compensation",
      "The salary joins after commission.",
      "The agreement includes two pay components. Commission is determined first; the fixed base salary is then added once. This is the base-plus-commission total—not sales plus salary.",
    ],
    [
      "Carry forward",
      "Pass on the commission—not the whole total.",
      "When you later work out gross income, you can use this commission without recalculating it. The base-plus total stays here, so the salary is never counted twice.",
    ],
  ];
  return (
    <section
      className={t.teaching}
      aria-label="The June relationship and transfer explanation"
    >
      <header className={t.sectionHeading}>
        <p className={base.eyebrow}>FOLLOW THE RELATIONSHIP</p>
        <h3>
          A commission.
          <br />
          <em>A total. Different jobs.</em>
        </h3>
        <p>
          Compare this worked explanation with your recorded response. What
          would you keep—or explain differently?
        </p>
      </header>
      <div className={t.workspace}>
        <TransferEvidence
          projection={projection}
          solved
          blocked={blocked}
          focus={["commission", "total", "commission"][link] ?? "all"}
        />
        <div>
          <nav className={t.steps} aria-label="Explore the pay connections">
            {links.map(([label], index) => (
              <button
                key={label}
                disabled={blocked}
                aria-current={link === index ? "step" : undefined}
                onClick={() => setLink(index)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div key={link} className={t.reading} role="status">
            <h4>{links[link]![1]}</h4>
            <p>{links[link]![2]}</p>
          </div>
          <div className={t.ownership}>
            <div>
              <span>COMMISSION · CARRY FORWARD</span>
              <strong>₱3,600</strong>
              <p>The commission you can carry forward to gross income.</p>
            </div>
            <div>
              <span>BASE-PLUS TOTAL · STAYS HERE</span>
              <strong>₱18,600</strong>
              <p>Lina’s base salary and commission together.</p>
            </div>
            <div>
              <span>SEPARATE ALLOWANCE · OUTSIDE THIS TASK</span>
              <strong>Not added here</strong>
              <p>
                The ₱800 communication allowance belongs to the separate Gross
                Income scenario.
              </p>
            </div>
          </div>
          {[
            "accessibility-summary",
            "provider-note",
            "common-ownership-explanation",
          ].map((role) => {
            const item = copy(role);
            return item ? (
              <p
                key={role}
                className={t.sourcePassage}
                data-content-id={item.id}
              >
                {item.text}
              </p>
            ) : null;
          })}
        </div>
      </div>
    </section>
  );
}
