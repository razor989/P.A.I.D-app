/** A domain cause, never a technical read/persistence failure. */
export type DomainResolution<T> =
  | Readonly<{ kind: "KNOWN"; value: T }>
  | Readonly<{ kind: "NOT_APPLICABLE" }>
  | Readonly<{ kind: "UNKNOWN"; reason: string }>
  | Readonly<{ kind: "UNDEFINED"; reason: string }>;

export type ResultAvailability = "AVAILABLE" | "WITHHELD";

/** Exposure does not replace or erase the underlying domain resolution. */
export type Result<T> = Readonly<{
  resolution: DomainResolution<T>;
  availability: ResultAvailability;
}>;

export function known<T>(value: T): DomainResolution<T> {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "number" && Number.isNaN(value)) ||
    value === "" ||
    value === false
  ) {
    throw new TypeError(
      "KNOWN requires an explicit value, not a semantic sentinel",
    );
  }
  return { kind: "KNOWN", value };
}

export function notApplicable<T>(): DomainResolution<T> {
  return { kind: "NOT_APPLICABLE" };
}

function requireReason(reason: string): string {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new TypeError("A nonempty domain reason is required");
  }
  return reason;
}

/** Only for missing authoritative input, not a technical failure. */
export function unknown<T>(reason: string): DomainResolution<T> {
  return { kind: "UNKNOWN", reason: requireReason(reason) };
}

/** Only for an undefined operation with established inputs. */
export function undefinedResult<T>(reason: string): DomainResolution<T> {
  return { kind: "UNDEFINED", reason: requireReason(reason) };
}

export function result<T>(
  resolution: DomainResolution<T>,
  availability: ResultAvailability,
): Result<T> {
  if (availability !== "AVAILABLE" && availability !== "WITHHELD") {
    throw new TypeError("Invalid result availability");
  }
  return { resolution, availability };
}
