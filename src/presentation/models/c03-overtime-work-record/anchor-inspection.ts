/** Placement of a C03 fact inspection beside the fact that opened it.
 *
 * The panel opens below its trigger when it fits, above it when only that
 * fits, and otherwise falls back to the original clamp. It never covers its
 * own trigger when either side has room, so the press that opened it still
 * lands on the trigger. */
const EDGE = 12;
const GAP = 12;
/** Height assumed before the panel has rendered (the original 370px clamp). */
const ESTIMATED_HEIGHT = 358;

export function anchorInspection(
  box: DOMRect,
  measuredHeight?: number,
): { left: number; top: number } {
  const width = Math.min(360, innerWidth - 24);
  const height = measuredHeight || ESTIMATED_HEIGHT;
  const left = Math.max(EDGE, Math.min(innerWidth - width - EDGE, box.left));
  const below = box.bottom + GAP;
  const above = box.top - GAP - height;
  const floor = innerHeight - EDGE - height;
  const top =
    below <= floor ? below : above >= EDGE ? above : Math.min(floor, below);
  return { left, top: Math.max(EDGE, top) };
}
