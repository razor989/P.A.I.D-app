// Fixed worked example, not learner scoring or completion authority.
export function recap(question: number) {
  const model = (id: "A" | "B", share: boolean) => {
    const original = id === "A" ? "₱20,000" : "₱10,000";
    const next = id === "A" ? "₱22,000" : "₱12,000";
    const decimal = id === "A" ? "0.10" : "0.20";
    const percent = id === "A" ? "10%" : "20%";
    const width = share ? 200 : id === "A" ? 200 : 100;
    const added = share && id === "B" ? 40 : 20;
    return `<figure class="recap-employee" data-recap-employee="${id}" data-scale="${share ? "own-original" : "shared-pesos"}">
      <figcaption><span class="recap-identity" aria-hidden="true">${id === "A" ? "● A" : "◆ B"}</span><h4>Employee ${id}</h4>${share ? `<strong class="recap-result">${percent}<span>increase</span></strong>` : `<p>${original} → ${next}</p>`}</figcaption>
      <svg viewBox="0 0 260 60" role="img" aria-label="Employee ${id}: ${share ? `own original ${original} is 100%; separate addition is ${percent} of that original` : `original ${original} plus ₱2,000 on the same peso scale as the other employee`}">
        <rect class="recap-original" x="4" y="10" width="${width}" height="36" rx="3" />
        <rect class="recap-added" x="${width + 8}" y="10" width="${added}" height="36" rx="3" />
      </svg>
      <div class="recap-model-key"><p>Original <strong>${original}${share ? " = 100%" : ""}</strong></p><p>Added <strong>₱2,000${share ? ` = ${percent}` : ""}</strong></p></div>
      ${share ? `<div class="recap-calculation"><p class="recap-calculation-label">Change ÷ ${id}’s own original</p><p>₱2,000 ÷ ${original} = ${decimal}</p><p>${decimal} × 100 = ${id === "A" ? "10" : "20"} → <strong>${percent}</strong></p></div>` : ""}
    </figure>`;
  };
  return `<section class="completion recap-summary" data-recap>
    <header class="recap-hero">
      <div class="completion-seal" aria-hidden="true">✓</div>
      <p class="recap-eyebrow">Guided practice finished</p>
      <h2 tabindex="-1">Always ask:<br><em>“Compared with what?”</em></h2>
      <p class="recap-takeaway">Same <strong>₱2,000</strong> raise.<br>Different <strong>percentage increases.</strong></p>
      <p class="recap-stage" data-recap-stage>Guided practice ended at question ${question + 1} of 3.</p>
    </header>
    <section class="recap-cash" aria-labelledby="recap-pesos-title"><div class="recap-section-heading"><span aria-hidden="true">01</span><div><h3 id="recap-pesos-title">Same peso scale</h3><p>Same width, same cash amount.</p></div></div>
      <div class="recap-grid">${model("A", false)}${model("B", false)}</div>
    </section>
    <section aria-labelledby="recap-shares-title"><div class="recap-section-heading"><span aria-hidden="true">02</span><div><h3 id="recap-shares-title">Each original = 100%</h3><p>Same raise, different shares of their own originals.</p></div></div>
      <p class="recap-scale-note">Equal widths here represent <strong>different peso amounts</strong>. Each nonzero original is its own 100%—not a shared peso scale.</p>
      <div class="recap-grid">${model("A", true)}${model("B", true)}</div>
      <p class="recap-insight">One tenth of A’s original. One fifth of B’s.<br><strong>Same positive addition + smaller positive original → larger percentage increase.</strong></p>
    </section>
    <section class="recap-transfer" aria-labelledby="recap-transfer-title"><h3 id="recap-transfer-title">Take the reasoning with you</h3>
      <ol class="recap-steps"><li><span>01</span><strong>Find the change</strong><p>New − Original</p></li><li><span>02</span><strong>Compare</strong><p>÷ nonzero original</p></li><li><span>03</span><strong>Express as a percentage</strong><p>× 100, then write %</p></li></ol>
      <p class="recap-formula"><span>Percentage change</span><strong><span class="fraction"><span>New − Original</span><span>Original</span></span> × 100%</strong></p>
      <div class="recap-footnotes"><p><strong>Match units.</strong> Use the same kind of quantity before and after.</p><p><strong>Read the sign.</strong> For a positive original: + increase, − decrease, 0 no change.</p><p><strong>Original is zero?</strong> Percentage change is undefined: division by zero is undefined.</p></div>
    </section>
    <div class="completion-actions"><button class="primary" data-action="review">Revisit the explanation →</button><button class="text-button" data-action="return-library">Return to the Learning Library</button></div>
  </section>`;
}
