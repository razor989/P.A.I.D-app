/** One explanation moment as a complete, readable thought.
 *
 * The text is never withheld or duplicated: a passage appears whole when its
 * moment arrives (see `.passage` in explore.module.css for the entrance), so
 * paused, scrubbed and screen-reader views all read the same sentence. */
export function ExploreNarration({ text }: { text: string }) {
  return <p>{text}</p>;
}
