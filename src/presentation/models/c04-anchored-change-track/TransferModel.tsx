import { useEffect, useId, useRef } from "react";
import type { C04Presentation } from "./public";
import { createSalaryExploration } from "../c04-reference/employee-exploration";
import { offerMoney } from "./ApplyOffer";
import styles from "./transfer.module.css";

/** A peso scale, never a fictitious positive reference whole. The same scene survives disclosure. */
export function TransferModel({
  transfer,
  blocked,
}: Pick<C04Presentation, "transfer" | "blocked">) {
  const root = useRef<HTMLDivElement>(null),
    live = useRef(blocked),
    id = useId();
  live.current = blocked;
  const explained = Boolean(transfer?.explained && transfer.difference != null);
  useEffect(() => {
    if (!explained || !root.current) return;
    const controller = createSalaryExploration(root.current, {
      pause: () => {},
      blocked: () => live.current,
      reduced: () =>
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true,
      announce: (text) => {
        const el = root.current?.querySelector("[data-announce]");
        if (el) el.textContent = text;
      },
      copyDistance: 0,
      lessons: {
        original: {
          title: "Zero is still the original.",
          copy: "Before this change, there was no allowance. That’s why the original is just a mark with zero length, not a bar. It shows where we started: ₱0.",
          equation: "Original allowance = ₱0",
          labels: [
            "Original · zero-length mark",
            "No positive reference whole",
          ],
        },
        addition: {
          title: "The peso increase is defined.",
          copy: "All of this allowance is new money. Take away the ₱0 we started with and we’re left with a defined difference of ₱1,500, even though the percentage change isn’t defined.",
          equation: "₱1,500 − ₱0 = +₱1,500",
          labels: ["New minus Original", "A defined peso increase"],
        },
        total: {
          title: "A new amount is not a new denominator.",
          copy: "This ₱1,500 tells us what the allowance is now. But for percentage change, we compare the gain with what we had before—not with the new amount. We still need the original ₱0.",
          equation: "Percentage change uses Original, not New",
          labels: ["New allowance · ₱1,500", "Keep the original reference"],
        },
      },
    });
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const refresh = () => controller.refresh();
    media?.addEventListener("change", refresh);
    return () => {
      controller.dispose();
      media?.removeEventListener("change", refresh);
    };
  }, [explained]);
  const trigger = (part: string, label: string) =>
    explained
      ? {
          "data-explore": part,
          role: "button",
          tabIndex: blocked ? -1 : 0,
          "aria-label": label,
          "aria-controls": id,
          "aria-expanded": false,
          "aria-disabled": blocked,
        }
      : {};
  return (
    <div ref={root} className={styles.model}>
      <figure
        className={`story-salary ${styles.allowance}`}
        aria-label="Monthly communication allowance on one peso scale"
      >
        <div className="model-heading">
          <span className={styles.allowanceIcon} aria-hidden="true">
            ₱
          </span>
          <div>
            <h3>A new allowance</h3>
            <p>Communication · per month</p>
          </div>
        </div>
        <svg
          viewBox="0 0 560 340"
          className={styles.scale}
          role="group"
          aria-label={`Original allowance ${transfer?.original != null ? `${offerMoney(transfer.original)}.` : "not exposed."} New allowance ${transfer?.next != null ? `${offerMoney(transfer.next)}.` : "not exposed."} Both use the same peso scale.`}
        >
          <g {...trigger("original", "Inspect the original allowance")}>
            <rect
              x="20"
              y="10"
              width="520"
              height="112"
              className={styles.hitArea}
            />
            <text x="32" y="34" className={styles.role}>
              Original
            </text>
            <text x="520" y="34" textAnchor="end" className={styles.amount}>
              {transfer?.original != null ? offerMoney(transfer.original) : "—"}
            </text>
            <path d="M32 91H520" className={styles.guide} />
            <rect x="32" y="64" width="0" height="54" data-zero-bar />
            {transfer?.original != null && (
              <path d="M32 64V118" className={styles.zero} />
            )}
            <text x="47" y="98" className={styles.small}>
              Before the allowance
            </text>
          </g>
          <g {...trigger("total", "Inspect the new allowance")}>
            <text x="32" y="169" className={styles.role}>
              New
            </text>
            <text x="520" y="169" textAnchor="end" className={styles.amount}>
              {transfer?.next != null ? offerMoney(transfer.next) : "—"}
            </text>
            <rect
              x="32"
              y="192"
              width={transfer?.next != null ? 488 : 0}
              height="54"
              rx="4"
              className={styles.newBar}
              data-new-bar
            />
            <path d="M32 256V265H520V256" className={styles.bracket} />
          </g>
          {explained && (
            <g {...trigger("addition", "Inspect the peso increase")}>
              <rect
                x="20"
                y="274"
                width="520"
                height="56"
                className={styles.hitArea}
              />
              <text
                x="276"
                y="309"
                textAnchor="middle"
                className={styles.change}
              >
                Increase · +{offerMoney(transfer!.difference!)}
              </text>
            </g>
          )}
        </svg>
        <figcaption>
          {explained
            ? "The gain is ₱1,500. The original is still the ₱0 we started with."
            : transfer?.original != null
              ? "One peso scale for both moments. The original mark has no length."
              : "One peso scale for both moments."}
        </figcaption>
      </figure>
      {explained && (
        <>
          <p className="story-explore-hint">
            Hover, focus or tap a part of the model for a closer look.
          </p>
          <div className={`story-exploration-slot ${styles.inspectionSlot}`}>
            <aside
              className="story-callout"
              id={id}
              aria-label="Allowance inspection"
              hidden
            >
              <header>
                <span className="story-kicker">A CLOSER LOOK</span>
                <button
                  type="button"
                  data-explore-close
                  aria-label="Close allowance inspection"
                >
                  ×
                </button>
              </header>
              <h3 />
              <svg
                className="explore-diagram"
                viewBox="0 0 300 118"
                role="img"
                aria-label=""
              >
                <text x="8" y="17" data-mini-label />
                <path d="M8 30V68" className={styles.zero} />
                <rect
                  className="mini-copy"
                  x="8"
                  y="32"
                  width="0"
                  height="32"
                />
                <g className="mini-add">
                  <path d="M8 73H278" className={styles.bracket} />
                </g>
                <path className="mini-reference" d="M8 72V79" />
                <text x="8" y="103" data-mini-result />
              </svg>
              <p className="mini-equation" />
              <p className="mini-copy-text" />
              <footer>
                <span>Keep the reference in view</span>
                <button
                  type="button"
                  data-explore-replay
                  aria-label="Replay supplemental diagram"
                >
                  ↻
                </button>
              </footer>
            </aside>
          </div>
          <span className={styles.srOnly} role="status" data-announce />
        </>
      )}
    </div>
  );
}
