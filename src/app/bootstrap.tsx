import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CompositionRoot } from "./composition-root";

export function bootstrap(container: HTMLElement): void {
  createRoot(container).render(
    <StrictMode>
      <CompositionRoot />
    </StrictMode>,
  );
}