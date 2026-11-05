/** Parse familiar display formatting without accepting malformed grouping. */
export function parseExploreNumber(text: string, rate: boolean) {
  const cleaned = text
    .trim()
    .replace(rate ? /%$/ : /^₱\s*/, "")
    .trim();
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+|\d{1,3}(?:,\d{3})+(?:\.\d*)?)$/.test(cleaned)
  )
    return null;
  return cleaned.replace(/,/g, "");
}
