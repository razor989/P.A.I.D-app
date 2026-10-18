import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CompositionRoot } from "./composition-root";

export function bootstrap(container: HTMLElement): () => void {
  const root = createRoot(container);
  try {
    container.ownerDocument.title = "P.A.I.D. — Startup";
    root.render(
      <StrictMode>
        <CompositionRoot />
      </StrictMode>,
    );
  } catch (error) {
    root.unmount();
    throw error;
  }
  return () => root.unmount();
}
