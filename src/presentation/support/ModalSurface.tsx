import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import styles from "./support.module.css";

export type ModalSurfaceProps = Readonly<{
  open: boolean;
  title: string;
  description: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  invokingControlRef?: RefObject<HTMLElement | null>;
}>;

export function ModalSurface({
  open,
  title,
  description,
  closeLabel,
  onClose,
  children,
  initialFocusRef,
  invokingControlRef,
}: ModalSurfaceProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const ids = useId();
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const invoker =
      invokingControlRef?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    let requested = false;
    const requestClose = () => {
      if (requested) return;
      requested = true;
      onCloseRef.current();
    };
    const cancel = (event: Event) => {
      // Controlled close: a rejected caller request must not silently close the dialog.
      event.preventDefault();
      requestClose();
    };
    const closed = () => {
      // A cleanup close event can be queued until after StrictMode reopens it.
      // Only an actually closed dialog represents an external close request.
      if (!dialog.open) requestClose();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]',
        ),
      ].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled, [hidden], [inert]") &&
          !element.closest("[hidden], [inert]") &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden",
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        !dialog.contains(document.activeElement) ||
        (event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog))
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("close", closed);
    dialog.addEventListener("keydown", keydown);
    const button = closeRef.current;
    button?.addEventListener("click", requestClose);
    if (!dialog.open) dialog.showModal();
    const initial = initialFocusRef?.current;
    (initial && dialog.contains(initial) ? initial : button)?.focus();
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.removeEventListener("close", closed);
      dialog.removeEventListener("keydown", keydown);
      button?.removeEventListener("click", requestClose);
      if (dialog.open) dialog.close();
      if (
        invoker?.isConnected &&
        !invoker.matches(":disabled, [inert]") &&
        !invoker.closest("[inert]")
      )
        invoker.focus();
    };
  }, [open, initialFocusRef, invokingControlRef]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-labelledby={`${ids}-title`}
      aria-describedby={`${ids}-description`}
      tabIndex={-1}
    >
      {open && (
        <>
          <h2 id={`${ids}-title`}>{title}</h2>
          <p id={`${ids}-description`}>{description}</p>
          <button ref={closeRef} type="button" className={styles.close}>
            {closeLabel}
          </button>
          {children}
        </>
      )}
    </dialog>
  );
}
