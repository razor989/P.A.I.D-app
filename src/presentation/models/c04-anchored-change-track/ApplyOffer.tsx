import type { C04Presentation } from "./public";
import accepted from "./prepare.module.css";
import styles from "./apply.module.css";
export const offerMoney = (value: string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value));
/** Accepted A01 illustrated-document construction, using only exposed A03 source facts. */
export function ApplyOffer({ frame, apply }: C04Presentation) {
  const original = frame.exposedModelFacts.find(
      (f) => f.id === "c04/S03/selected-track/original",
    ),
    revised = frame.exposedModelFacts.find(
      (f) => f.id === "c04/S03/selected-track/newValue",
    );
  return (
    <figure
      className={`${accepted.scene} ${styles.offerStory}`}
      aria-label="The advertised and revised salary offers"
    >
      <svg
        className={accepted.documents}
        viewBox="0 0 470 340"
        role="group"
        aria-label="One position. Two monthly salary offers."
      >
        <circle cx="236" cy="150" r="125" fill="#e8eddc" />
        <path d="M74 302H396" className={accepted.line} />
        <g transform="translate(191 12)">
          <circle cx="44" cy="32" r="26" fill="#d9b99b" />
          <path d="M18 30Q16 0 43 4Q75 3 71 35L60 19L30 20Z" fill="#3d4836" />
          <path d="M2 100Q0 64 43 64Q86 64 88 100" fill="#879d65" />
          <text x="44" y="122" textAnchor="middle" className={accepted.name}>
            One position
          </text>
        </g>
        {[
          {
            fact: original,
            value: apply?.original,
            label: "ORIGINAL OFFER",
            caption: "As advertised",
            x: 16,
            y: 145,
          },
          {
            fact: revised,
            value: apply?.next,
            label: "REVISED OFFER",
            caption: "Before hiring",
            x: 250,
            y: 158,
          },
        ].map((item) => (
          <g key={item.label} transform={`translate(${item.x} ${item.y})`}>
            <rect className={accepted.paper} width="204" height="150" rx="8" />
            <text x="16" y="27" className={accepted.label}>
              {item.label}
            </text>
            <path d="M16 40H188" className={accepted.line} />
            {item.fact && (
              <text
                x="16"
                y="83"
                className={accepted.amount}
                data-fact-id={item.fact.id}
              >
                {item.value != null ? offerMoney(item.value) : item.fact.text}
              </text>
            )}
            <text x="16" y="111" className={accepted.small}>
              {item.caption}
            </text>
            <circle cx="174" cy="125" r="12" className={accepted.seal} />
            <path
              d="M168 125l4 4 8-9"
              fill="none"
              stroke="#53683d"
              strokeWidth="2"
            />
          </g>
        ))}
        <path
          d="M224 225h20m-7-6 7 6-7 6"
          fill="none"
          stroke="#879d65"
          strokeWidth="2"
        />
      </svg>
      <figcaption>Monthly salary · one position, two offers.</figcaption>
    </figure>
  );
}
