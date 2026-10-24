import { useEffect, useRef, useState } from "react";
import type { SafeAnnouncement } from "./public";
import { isEligibleTarget, MAX_STATUS_LENGTH } from "./focusPolicy";

/** Conservative DOM-only boundary: omit neither hidden nor inaccessible meaning silently. */
function visibleMeaning(source: HTMLElement): string | null {
  const view = source.ownerDocument.defaultView;
  if (!view) return null;
  let text = "";
  const visit = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return true;
    }
    if (!(node instanceof HTMLElement))
      return node.nodeType === Node.COMMENT_NODE;
    const style = view.getComputedStyle(node);
    if (
      node.matches(
        'script, style, template, [hidden], [inert], [aria-hidden="true"]',
      ) ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden" ||
      style.opacity === "0" ||
      node.getClientRects().length === 0
    )
      return false;
    // Announcements accept plain visible prose, not alternate labels or embedded controls.
    if (
      node.matches(
        "[aria-label], [aria-labelledby], input, textarea, select, img, svg",
      )
    )
      return false;
    return [...node.childNodes].every(visit);
  };
  return visit(source) ? text.trim() : null;
}

function isSafe(value: SafeAnnouncement | null): boolean {
  const source = value?.visibleSource.current ?? null;
  return (
    value !== null &&
    value.identity.length > 0 &&
    value.text.trim().length > 0 &&
    value.text.length <= MAX_STATUS_LENGTH &&
    isEligibleTarget(source) &&
    visibleMeaning(source) === value.text.trim()
  );
}

export function StatusAnnouncer({
  announcement,
}: {
  announcement: SafeAnnouncement | null;
}) {
  const lastIdentity = useRef<string | null>(null);
  const [current, setCurrent] = useState<SafeAnnouncement | null>(null);
  useEffect(() => {
    if (!isSafe(announcement) || !announcement) {
      setCurrent(null);
      return;
    }
    if (lastIdentity.current === announcement.identity) return;
    lastIdentity.current = announcement.identity;
    setCurrent(announcement);
  }, [announcement]);
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-accessibility-status=""
    >
      {isSafe(announcement) &&
        current &&
        current.identity === announcement?.identity &&
        current.text === announcement?.text && (
          <span key={current.identity}>{current.text}</span>
        )}
    </p>
  );
}
