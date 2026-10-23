// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ModalSurface } from "./public";

const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
beforeEach(() => {
  // jsdom has no native modal implementation. Browser suites are focus/inertness authority.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalShowModal)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      originalShowModal,
    );
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose)
    Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

it("controls cancel requests once, strips closed content, and does not accumulate listeners", () => {
  const onClose = vi.fn();
  const props = {
    title: "Synthetic modal",
    description: "Read-only description",
    closeLabel: "Dismiss",
    onClose,
  };
  const view = render(
    <StrictMode>
      <ModalSurface {...props} open>
        <p>Supplied content</p>
      </ModalSurface>
    </StrictMode>,
  );
  const dialog = screen.getByRole("dialog");
  const cancel = new Event("cancel", { cancelable: true });
  fireEvent(dialog, cancel);
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  fireEvent.click(screen.getByRole("button"));
  expect(cancel.defaultPrevented).toBe(true);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(dialog.getAttribute("open")).not.toBeNull();
  view.rerender(
    <StrictMode>
      <ModalSurface {...props} open={false}>
        <p>Supplied content</p>
      </ModalSurface>
    </StrictMode>,
  );
  expect(view.container.innerHTML).not.toContain("Supplied content");
  expect(onClose).toHaveBeenCalledTimes(1);
  view.rerender(
    <StrictMode>
      <ModalSurface {...props} open>
        <p>New content</p>
      </ModalSurface>
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole("button"));
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("restores the connected local invoking control on caller closure and unmount", () => {
  const button = document.createElement("button");
  document.body.append(button);
  button.focus();
  const view = render(
    <ModalSurface
      open
      title="Modal"
      description="Description"
      closeLabel="Close"
      onClose={vi.fn()}
    >
      <p>Content</p>
    </ModalSurface>,
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Close" }),
  );
  view.unmount();
  expect(document.activeElement).toBe(button);
  button.remove();
});
