import {
  cloneElement,
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./floating-nav.module.css";

/** Where a lesson's own exit control is presented. Present only inside the
 * application shell's floating lesson navigation; a lesson rendered on its own
 * (unit tests, previews) keeps its original inline strip and masthead. */
type Slot = Readonly<{
  exit: HTMLElement | null;
  setExit: (element: HTMLElement | null) => void;
}>;

const LessonSlot = createContext<Slot | null>(null);

export function LessonNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [exit, setExit] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ exit, setExit }), [exit]);
  return <LessonSlot.Provider value={value}>{children}</LessonSlot.Provider>;
}

export function useLessonSlot() {
  return useContext(LessonSlot);
}

/** A lesson's leave control. The button (its label, availability and handler)
 * is owned by the lesson and passed through unchanged; only its placement
 * moves into the floating navigation's raised action. */
export function LessonExit({
  hint,
  className,
  children,
}: {
  hint: ReactNode;
  className?: string | undefined;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const slot = useContext(LessonSlot);
  const id = useId();
  if (!slot)
    return (
      <nav className={className} aria-label="Leave the lesson">
        <span>{hint}</span>
        {children}
      </nav>
    );
  if (!slot.exit) return null;
  return createPortal(
    <>
      {cloneElement(children, { "aria-describedby": id })}
      <span id={id} hidden>
        {hint}
      </span>
    </>,
    slot.exit,
  );
}

/** The per-lesson masthead. Inside the shell the floating navigation carries
 * the P.A.I.D. identity instead: the masthead's place becomes plain room for
 * the navigation to rest over, within the lesson's own background. */
export function LessonMasthead({ children }: { children: ReactNode }) {
  return useContext(LessonSlot) ? (
    <div className={styles.spacer} data-lesson-spacer="" aria-hidden="true" />
  ) : (
    children
  );
}
