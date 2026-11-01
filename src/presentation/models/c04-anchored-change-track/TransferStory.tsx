import { useEffect, useId, useRef, useState } from "react";
import styles from "./transfer.module.css";

const scenes = [
  {
    title: "At the shop",
    before: "₱200",
    after: "₱250",
    change: "+₱50",
    result: "25% increase",
    question:
      "A familiar purchase. A higher price. How much has really changed?",
    explanation: "₱50 more—one quarter of the original ₱200.",
    equation: "₱50 ÷ ₱200 × 100 = 25%",
    originalWidth: 320,
    newWidth: 400,
    kind: "price",
  },
  {
    title: "A smaller bill",
    before: "₱1,000",
    after: "₱800",
    change: "−₱200",
    result: "20% decrease",
    question:
      "This month’s bill is smaller. What part of the old bill have we saved?",
    explanation: "₱200 saved—one fifth of the original ₱1,000 bill.",
    equation: "−₱200 ÷ ₱1,000 × 100 = −20%",
    originalWidth: 400,
    newWidth: 320,
    kind: "bill",
  },
  {
    title: "A new beginning",
    before: "₱0",
    after: "₱500",
    change: "+₱500",
    result: "Percentage change undefined",
    question: "The first ₱500 matters. But what if we started with nothing?",
    explanation:
      "A real gain of ₱500. But dividing by the original zero is impossible, so its percentage change is undefined.",
    equation: "₱500 − ₱0 = +₱500 · We cannot divide by zero",
    originalWidth: 0,
    newWidth: 240,
    kind: "savings",
  },
] as const;

/** Optional COMPLETE-only illustrations: no assessment, persistence or progression events. */
export function TransferStory({
  blocked,
  startOpen = false,
}: {
  blocked: boolean;
  startOpen?: boolean;
}) {
  const [scene, setScene] = useState(startOpen ? 0 : -1);
  const [revealed, setRevealed] = useState(false);
  const [replay, setReplay] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultId = useId();
  const example = scenes[scene];
  useEffect(() => {
    if (scene >= 0 && !blocked) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [scene, blocked]);
  const move = (next: number) => {
    setScene(next);
    setRevealed(false);
  };
  return (
    <div
      className={styles.transferStory}
      role="group"
      aria-label="Percentage change in everyday life"
      data-transfer-story
      data-finale={scene === 3 || undefined}
      data-blocked={blocked || undefined}
    >
      <svg
        className={styles.storyAtmosphere}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="500" cy="450" r="290" />
        <circle cx="500" cy="450" r="335" />
        <ellipse
          cx="500"
          cy="450"
          rx="450"
          ry="160"
          transform="rotate(-28 500 450)"
        />
        <path d="M500 90V118M500 782V810M140 450H168M832 450H860" />
        <g>
          <circle cx="259" cy="289" r="3" />
          <circle cx="755" cy="588" r="4" />
          <circle cx="620" cy="186" r="2" />
        </g>
      </svg>
      {scene < 0 ? (
        <div className={styles.storyInvitation}>
          <div>
            <span className="eyebrow">BEYOND THE ALLOWANCE</span>
            <h3>
              Let’s take this idea <em>somewhere else.</em>
            </h3>
            <p>Beyond the numbers, there’s a way of seeing.</p>
          </div>
          <button
            className="secondary"
            disabled={blocked}
            onClick={() => move(0)}
          >
            See it in everyday life →
          </button>
        </div>
      ) : (
        <>
          <div className={styles.storyProgress} aria-label="Story progress">
            {[
              "At the shop",
              "A smaller bill",
              "A new beginning",
              "The connection",
            ].map((title, index) => (
              <button
                key={title}
                disabled={blocked}
                aria-current={scene === index ? "step" : undefined}
                onClick={() => move(index)}
              >
                <span aria-hidden="true">0{index + 1}</span>
                {title}
              </button>
            ))}
          </div>
          <div key={scene} className={styles.storyScene}>
            <header>
              <span className="eyebrow">
                {scene < 3
                  ? `EVERYDAY LIFE / 0${scene + 1}`
                  : "DIFFERENT SITUATIONS · THE SAME THINKING"}
              </span>
              <h3 ref={heading} tabIndex={-1}>
                {example?.title ?? "What did we start with?"}
              </h3>
              {example && <p>{example.question}</p>}
            </header>
            {example ? (
              <>
                <div
                  className={styles.storyCinema}
                  data-object={example.kind}
                  key={`${scene}-${replay}`}
                  data-revealed={revealed || undefined}
                >
                  <svg
                    className={styles.storyObject}
                    viewBox="0 0 300 210"
                    role="img"
                    aria-label={
                      example.kind === "price"
                        ? "A product with its price tag"
                        : example.kind === "bill"
                          ? "A monthly bill"
                          : "A savings jar receiving its first money"
                    }
                  >
                    <g aria-hidden="true" className={styles.storyWorld}>
                      <circle cx="150" cy="99" r="88" />
                      <ellipse cx="150" cy="186" rx="145" ry="22" />
                      <path d="M0 186H300M18 198H282M30 173L270 173" />
                    </g>
                    <ellipse
                      cx="150"
                      cy="187"
                      rx="112"
                      ry="10"
                      className={styles.storyShadow}
                    />
                    {example.kind === "price" ? (
                      <g className={styles.storyProp}>
                        <path
                          d="M62 57H177V159H62Z"
                          className={styles.storyPaper}
                        />
                        <path
                          d="M177 57L214 28V128L177 159Z"
                          className={styles.storySide}
                        />
                        <path
                          d="M62 57L101 28H214L177 57Z"
                          className={styles.storyTop}
                        />
                        <path
                          d="M119 57L158 28H175L136 57V91H119Z"
                          className={styles.storyTape}
                        />
                        <path
                          d="M142 97Q137 64 128 63"
                          className={styles.storyOutline}
                        />
                        <g className={styles.storyDetail}>
                          <path
                            d="M142 97L164 78H252V135H164L142 116Z"
                            className={styles.storyGold}
                          />
                          <circle
                            cx="162"
                            cy="107"
                            r="4"
                            className={styles.storyOutline}
                          />
                          <text x="201" y="116" textAnchor="middle">
                            ₱250
                          </text>
                        </g>
                      </g>
                    ) : example.kind === "bill" ? (
                      <g className={styles.storyProp}>
                        <path
                          d="M84 28H230V181L212 173L194 181L176 173L158 181L140 173L122 181L104 173L84 181Z"
                          className={styles.storySide}
                        />
                        <path
                          d="M77 22H223V175L205 167L187 175L169 167L151 175L133 167L115 175L97 167L77 175Z"
                          className={styles.storyPaper}
                        />
                        <text x="150" y="55" textAnchor="middle">
                          MONTHLY BILL
                        </text>
                        <path
                          d="M102 76H198M102 91H178M102 106H188"
                          className={styles.storyOutline}
                        />
                        <g className={styles.storyDetail}>
                          <path
                            d="M102 126H198V155H102Z"
                            className={styles.storyGold}
                          />
                          <text x="150" y="147" textAnchor="middle">
                            ₱800
                          </text>
                        </g>
                      </g>
                    ) : (
                      <g className={styles.storyProp}>
                        <path
                          d="M99 54V76Q74 88 74 111V162Q74 178 94 178H206Q226 178 226 162V111Q226 88 201 76V54Z"
                          className={styles.storyPaper}
                        />
                        <path
                          d="M94 47H206V62H94Z"
                          className={styles.storyGold}
                        />
                        <path
                          d="M112 72Q89 91 89 115V154M212 104V153"
                          className={styles.storyGlass}
                        />
                        <path d="M125 52H175" className={styles.storyOutline} />
                        <g className={styles.storyDetail}>
                          <rect
                            x="109"
                            y="100"
                            width="82"
                            height="49"
                            rx="4"
                            className={styles.storyGold}
                          />
                          <text x="150" y="132" textAnchor="middle">
                            ₱500
                          </text>
                        </g>
                        <text x="150" y="169" textAnchor="middle">
                          SAVINGS
                        </text>
                      </g>
                    )}
                  </svg>
                  <div className={styles.storyAmounts}>
                    <div>
                      <span>We started with</span>
                      <strong>{example.before}</strong>
                    </div>
                    <span aria-hidden="true">→</span>
                    <div>
                      <span>Now we have</span>
                      <strong>{example.after}</strong>
                    </div>
                  </div>
                  <svg
                    className={styles.storyBars}
                    viewBox="0 0 520 240"
                    role="img"
                    aria-label={`Original ${example.before}; new ${example.after}. ${revealed ? `${example.change}; ${example.result}.` : "Compare the new amount with the original."}`}
                  >
                    <rect
                      x="26"
                      y="1"
                      width="468"
                      height="94"
                      rx="10"
                      className={styles.storyModelLane}
                    />
                    <rect
                      x="26"
                      y="99"
                      width="468"
                      height="78"
                      rx="10"
                      className={styles.storyModelLane}
                    />
                    <rect
                      x="36"
                      y="7"
                      width="112"
                      height="26"
                      rx="13"
                      className={styles.storyModelBadge}
                    />
                    <text
                      x="92"
                      y="26"
                      textAnchor="middle"
                      className={styles.storyModelLabel}
                    >
                      ORIGINAL
                    </text>
                    <text x="478" y="27" textAnchor="end">
                      {example.before}
                    </text>
                    <rect
                      x="36"
                      y="40"
                      width={example.originalWidth}
                      height="36"
                      rx="3"
                      className={styles.referenceBar}
                    />
                    {example.originalWidth === 0 && (
                      <path d="M36 40V76" className={styles.zero} />
                    )}
                    <rect
                      x="36"
                      y="101"
                      width="76"
                      height="22"
                      rx="11"
                      className={styles.storyModelBadge}
                    />
                    <text
                      x="74"
                      y="117"
                      textAnchor="middle"
                      className={styles.storyModelLabel}
                    >
                      NEW
                    </text>
                    <text x="478" y="119" textAnchor="end">
                      {example.after}
                    </text>
                    <rect
                      x="36"
                      y="126"
                      width={Math.min(example.originalWidth, example.newWidth)}
                      height="36"
                      rx="3"
                      className={styles.referenceBar}
                    />
                    <g
                      className={styles.storyChange}
                      style={{
                        transformOrigin: `${36 + Math.min(example.originalWidth, example.newWidth)}px 144px`,
                      }}
                    >
                      <rect
                        x={
                          36 + Math.min(example.originalWidth, example.newWidth)
                        }
                        y="126"
                        width={Math.abs(
                          example.newWidth - example.originalWidth,
                        )}
                        height="36"
                        rx="3"
                        className={
                          example.kind === "bill"
                            ? styles.storyRemoved
                            : styles.addedBar
                        }
                      />
                      <text
                        x={
                          36 +
                          Math.min(example.originalWidth, example.newWidth) +
                          Math.abs(example.newWidth - example.originalWidth) / 2
                        }
                        y="197"
                        textAnchor="middle"
                      >
                        {example.change}
                      </text>
                    </g>
                    <path
                      d={`M36 83V89H${36 + example.originalWidth}V83`}
                      className={styles.bracket}
                    />
                    <text x="36" y="232" className={styles.storyScale}>
                      Original and new use the same scale within this scene.
                    </text>
                  </svg>
                </div>
                <div className={styles.storyTeaching} id={resultId}>
                  {revealed ? (
                    <div role="status" aria-atomic="true">
                      <strong>{example.result}</strong>
                      <p>{example.explanation}</p>
                      <p className={styles.storyEquation}>{example.equation}</p>
                    </div>
                  ) : (
                    <p>Start with the original. Then follow the change.</p>
                  )}
                  <button
                    className="secondary"
                    disabled={blocked}
                    aria-controls={resultId}
                    aria-expanded={revealed}
                    onClick={() => {
                      setRevealed(true);
                      setReplay((value) => value + 1);
                    }}
                  >
                    {revealed ? "Replay scene ↻" : "Show me the comparison"}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.storyConnections}>
                {scenes.map((item) => (
                  <div key={item.kind}>
                    <span className="eyebrow">{item.title}</span>
                    <p>
                      <strong>{item.before}</strong>
                    </p>
                    <span>{item.result}</span>
                  </div>
                ))}
                <p className={styles.storyClosing}>
                  Different stories. The same starting question.
                  <span>Take it with you.</span>
                </p>
              </div>
            )}
          </div>
          <div className={styles.storyNavigation}>
            <button
              className="text-button"
              disabled={blocked || scene === 0}
              onClick={() => move(scene - 1)}
            >
              ← Previous scene
            </button>
            <span>{scene + 1} of 4</span>
            {scene < 3 ? (
              <button
                className="secondary"
                disabled={blocked}
                onClick={() => move(scene + 1)}
              >
                Next scene →
              </button>
            ) : (
              <button
                className="secondary"
                disabled={blocked}
                onClick={() => move(0)}
              >
                Watch again ↻
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
