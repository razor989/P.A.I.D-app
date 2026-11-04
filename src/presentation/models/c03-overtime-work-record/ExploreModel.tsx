import type { C03WorkRecordProjection } from "./public";
import { pesos } from "./WorkEvidence";
import { ExploreInspection, Inspectable } from "./ExploreInspection";
import { ExploreGlyph, ExploreHourMark } from "./ExploreGlyph";
import explore from "./explore.module.css";

/** One work record. Widths project exposed quantities; no pay is evaluated here. */
export function ExploreModel({
  projection,
  stage = 3,
  cue = 5,
  progress = 1,
  blocked = false,
  compact = false,
  onInspect,
  onSelectCondition,
  focus,
}: {
  projection: C03WorkRecordProjection;
  stage?: number;
  cue?: number;
  progress?: number;
  blocked?: boolean;
  compact?: boolean;
  onInspect?: () => void;
  onSelectCondition?: ((id: string) => void) | undefined;
  focus?: string | undefined;
}) {
  const {
    workEvidence,
    mathematicalExplanation: math,
    comparison,
    frame,
  } = projection;
  const reveal = (start: number, duration = 1) =>
    Math.max(0, Math.min(1, (cue + progress - start) / duration));
  const paired = Boolean(comparison && stage >= 3);
  const showMath = stage > 0 && math;
  const multiplier = showMath
    ? Number(math.multiplier.magnitude.toString())
    : 1;
  const extension = (multiplier - 1) * 135 * reveal(1, 1.5);
  const amount =
    math?.overtimePay.resolution.kind === "KNOWN"
      ? pesos(math.overtimePay.resolution.value.magnitude.toString())
      : null;
  const control = frame.modelSelectionControl;
  const inspected = frame.allowedLearnerIntents.includes("CONTINUE");
  const model = (
    <section
      className={`${explore.unifiedRecord} ${compact ? explore.compact : ""}`}
      aria-label="Overtime work record laboratory"
      data-focus={focus}
    >
      <header className={explore.recordIdentity}>
        <span className={explore.nicoBadge} aria-hidden="true">
          N
        </span>
        <div>
          <span>Nico’s overtime</span>
          <strong>
            {paired
              ? "Two kinds of day"
              : (math?.condition ?? "Two extra hours")}
          </strong>
        </div>
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <rect
            x="8"
            y="12"
            width="44"
            height="40"
            rx="6"
            fill="#e5ead7"
            stroke="#718951"
          />
          <path d="M8 25h44M20 7v12M40 7v12" stroke="#718951" strokeWidth="3" />
          <path
            d={
              math?.condition === "rest day"
                ? "M35 30a10 10 0 1 0 9 13A11 11 0 0 1 35 30"
                : "m19 37 8 8 16-15"
            }
            fill="none"
            stroke="#435432"
            strokeWidth="3"
          />
        </svg>
      </header>
      {control && onSelectCondition && (
        <div
          className={explore.dayDock}
          role="group"
          aria-label="Choose the work condition"
        >
          {control.options.map((option) => (
            <button
              key={option.id}
              aria-pressed={control.selectedId === option.id}
              disabled={blocked}
              onClick={() => onSelectCondition(option.id)}
            >
              {stage === 1
                ? `${inspected ? "✓ " : ""}Inspect ordinary working day`
                : option.text}
            </button>
          ))}
          {stage === 1 && !inspected && <p>Open this record to continue ↓</p>}
        </div>
      )}
      <div className={explore.recordFacts}>
        <Inspectable part="rate" className={explore.factLink}>
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="16" fill="#e5ead7" stroke="#718951" />
            <text
              x="20"
              y="27"
              textAnchor="middle"
              fill="#435432"
              fontSize="23"
            >
              ₱
            </text>
          </svg>
          <span>
            <small>Regular rate</small>
            <strong>
              {pesos(workEvidence.rate.magnitude.toString())}
              <small> / h</small>
            </strong>
          </span>
        </Inspectable>
        <Inspectable part="hours" className={explore.factLink}>
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="16" fill="#fff2dc" stroke="#b28248" />
            <path
              d="M20 9v12l8 4"
              stroke="#71531d"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          <span>
            <small>Overtime</small>
            <strong>{workEvidence.hours.magnitude.toString()} hours</strong>
          </span>
        </Inspectable>
      </div>
      {paired ? (
        <div className={explore.pairedPay}>
          {comparison!.map((item, index) => {
            const value =
              item.overtimePay.resolution.kind === "KNOWN"
                ? item.overtimePay.resolution.value.magnitude.toString()
                : null;
            const visibility = compact ? 1 : reveal(index + 1, 1);
            return (
              <figure
                key={item.condition}
                style={{ opacity: visibility ? 1 : 0.25 }}
              >
                <figcaption>
                  <Inspectable part="condition">
                    <ExploreGlyph name={index ? "rest" : "day"} />
                    {index ? "Rest day" : "Ordinary day"}
                  </Inspectable>
                  <Inspectable part="multiplier">
                    × {item.multiplier.magnitude.toString()}
                  </Inspectable>
                </figcaption>
                <svg
                  viewBox="0 0 380 73"
                  role="img"
                  aria-label={`${item.condition}: ${value ? pesos(value) : "pay not established"}`}
                >
                  <path d="M4 55h365" stroke="#b7c3a5" />
                  <rect
                    x="4"
                    y="12"
                    width={value ? Number(value) * visibility : 0}
                    className={compact ? explore.recapPayBar : undefined}
                    height="32"
                    rx="3"
                    fill={index ? "#b28248" : "#718951"}
                  />
                  {!compact && cue >= 3 && index === 1 && (
                    <path
                      d="M254 5v49M254 62v6h88v-6"
                      stroke="#71531d"
                      strokeWidth="2"
                      fill="none"
                    />
                  )}
                </svg>
                <div className={explore.recordResult}>
                  <span>
                    {pesos(workEvidence.rate.magnitude.toString())} ×{" "}
                    {item.multiplier.magnitude.toString()} ×{" "}
                    {workEvidence.hours.magnitude.toString()}
                  </span>
                  <Inspectable part="pay">
                    {value ? pesos(value) : "—"}
                  </Inspectable>
                </div>
              </figure>
            );
          })}
        </div>
      ) : (
        <div className={explore.hourlyScene}>
          <svg
            viewBox="0 -46 390 300"
            role="group"
            aria-label="Two overtime hours on one work record; the pay for each hour develops with the explanation"
          >
            <defs>
              <pattern
                id={`premium-${stage}`}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
              >
                <path d="M0 7 7 0" stroke="#b28248" strokeWidth="2" />
              </pattern>
            </defs>
            <foreignObject x="95" y="-44" width="280" height="56">
              <div className={explore.modelAnnotations}>
                <Inspectable part="rate" className={explore.rateTag}>
                  Regular-rate reference
                </Inspectable>
                {showMath && (
                  <Inspectable
                    part="multiplier"
                    className={explore.multiplierTag}
                  >
                    × {math.multiplier.magnitude.toString()}
                  </Inspectable>
                )}
              </div>
            </foreignObject>
            <path d="M95 19v-24h135v24" fill="none" stroke="#879d65" />
            <path d="M55 25v155" stroke="#b7c3a5" strokeWidth="2" />
            {[0, 1].map((hour) => (
              <g key={hour} transform={`translate(0 ${30 + hour * 85})`}>
                <path d="M80 20h15" stroke="#b7c3a5" />
                <g transform="translate(55 20)">
                  <ExploreHourMark />
                </g>
                <rect
                  x="95"
                  y="0"
                  width={135 * (stage === 0 ? reveal(0.5, 1) : 1)}
                  height="40"
                  rx="4"
                  fill="#879d65"
                />
                {showMath && (
                  <g>
                    <rect
                      x="230"
                      y="0"
                      width={extension}
                      height="40"
                      fill={`url(#premium-${stage})`}
                      stroke="#b28248"
                    />
                    <path
                      d={`M95 47v6h${135 + extension}v-6`}
                      fill="none"
                      stroke="#718951"
                    />
                    <text x="95" y="72" fontSize="14" fill="#52645a">
                      {cue >= 1
                        ? `${pesos(workEvidence.rate.magnitude.toString())} × ${math.multiplier.magnitude.toString()}`
                        : ""}
                    </text>
                  </g>
                )}
              </g>
            ))}
            {showMath && cue >= 3 && (
              <g opacity={reveal(3)}>
                <path d="M95 207h230" stroke="#b7c3a5" />
                <foreignObject x="95" y="213" width="280" height="40">
                  <div className={explore.modelPayResult}>
                    <Inspectable part="pay" className={explore.payTag}>
                      {amount} <span>overtime pay</span>
                    </Inspectable>
                  </div>
                </foreignObject>
              </g>
            )}
          </svg>
        </div>
      )}
    </section>
  );
  return onInspect ? (
    model
  ) : (
    <ExploreInspection projection={projection} blocked={blocked}>
      {model}
    </ExploreInspection>
  );
}
