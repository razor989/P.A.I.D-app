import type { ReactNode } from "react";
import type { ActivityStep } from "../content";

/** One activity cover: a vertical gradient, the ink used for its typographic
 * block, and decorative artwork drawn in the 300×400 cover frame below the
 * title (roughly y 150–370). */
export type Cover = Readonly<{
  top: string;
  bottom: string;
  ink: string;
  art: ReactNode;
}>;

export type CoverSet = Readonly<{
  /** Uppercase competency name printed at the foot of each cover. */
  footer: string;
  covers: Readonly<Record<ActivityStep, Cover>>;
}>;
