import BigNumber from "bignumber.js";

/** Missing numerical authority is a technical/policy failure, not a domain value. */
export class DecimalPrecisionAuthorityError extends Error {
  constructor() {
    super(
      "Nonterminating decimal division requires explicit precision and rounding",
    );
    this.name = "DecimalPrecisionAuthorityError";
  }
}

export class DecimalDivisionByZeroError extends Error {
  constructor() {
    super("Division by zero has no finite decimal result");
    this.name = "DecimalDivisionByZeroError";
  }
}

export type RoundingMode = "DOWN" | "UP" | "HALF_UP" | "HALF_EVEN";
export type PrecisionDecision = Readonly<{
  decimalPlaces: number;
  roundingMode: RoundingMode;
}>;

function validateDecision(decision: PrecisionDecision): BigNumber.RoundingMode {
  if (
    decision === null ||
    typeof decision !== "object" ||
    !Number.isSafeInteger(decision.decimalPlaces) ||
    decision.decimalPlaces < 0 ||
    decision.decimalPlaces > 1_000_000_000
  ) {
    throw new TypeError(
      "An explicit supported nonnegative decimal-place scale is required",
    );
  }
  switch (decision.roundingMode) {
    case "DOWN":
      return BigNumber.ROUND_DOWN;
    case "UP":
      return BigNumber.ROUND_UP;
    case "HALF_UP":
      return BigNumber.ROUND_HALF_UP;
    case "HALF_EVEN":
      return BigNumber.ROUND_HALF_EVEN;
    default:
      throw new TypeError("An explicit supported rounding mode is required");
  }
}

function parts(value: BigNumber): readonly [bigint, bigint] {
  const text = value.toFixed();
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const dot = unsigned.indexOf(".");
  const digits = unsigned.replace(".", "");
  const scale = dot < 0 ? 0 : unsigned.length - dot - 1;
  return [BigInt(negative ? `-${digits}` : digits), 10n ** BigInt(scale)];
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** Returns a finite decimal string, or null if the rational expansion repeats. */
function terminatingQuotient(
  numerator: BigNumber,
  divisor: BigNumber,
): string | null {
  const [left, leftDenominator] = parts(numerator);
  const [right, rightDenominator] = parts(divisor);
  let n = left * rightDenominator;
  let d = leftDenominator * right;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const common = gcd(n, d);
  n /= common;
  d /= common;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n) return null;
  const scale = Math.max(twos, fives);
  const scaled = n * 2n ** BigInt(scale - twos) * 5n ** BigInt(scale - fives);
  if (scale === 0) return scaled.toString();
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled)
    .toString()
    .padStart(scale + 1, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

/** Immutable public value; raw library instances never leave this adapter. */
export class ExactDecimal {
  readonly #value: BigNumber;

  private constructor(value: BigNumber) {
    if (!value.isFinite()) throw new TypeError("A finite decimal is required");
    this.#value = value;
    Object.freeze(this);
  }

  static from(value: string | ExactDecimal): ExactDecimal {
    if (value instanceof ExactDecimal) return value;
    if (typeof value !== "string" || !/^[+-]?(?:\d+)(?:\.\d+)?$/.test(value)) {
      throw new TypeError(
        "An authoritative decimal must be a finite decimal string",
      );
    }
    return new ExactDecimal(new BigNumber(value));
  }

  private static require(value: ExactDecimal): BigNumber {
    if (!(value instanceof ExactDecimal))
      throw new TypeError("An exact decimal is required");
    return value.#value;
  }

  add(other: ExactDecimal): ExactDecimal {
    return new ExactDecimal(this.#value.plus(ExactDecimal.require(other)));
  }

  subtract(other: ExactDecimal): ExactDecimal {
    return new ExactDecimal(this.#value.minus(ExactDecimal.require(other)));
  }

  multiply(other: ExactDecimal): ExactDecimal {
    return new ExactDecimal(this.#value.times(ExactDecimal.require(other)));
  }

  equals(other: ExactDecimal): boolean {
    return this.#value.isEqualTo(ExactDecimal.require(other));
  }

  compare(other: ExactDecimal): -1 | 0 | 1 {
    const comparison = this.#value.comparedTo(ExactDecimal.require(other));
    if (comparison === null)
      throw new TypeError("An exact decimal is required");
    return comparison;
  }

  /** Exact division, or explicitly authorized quantization of a repeating quotient. */
  divide(divisor: ExactDecimal, decision?: PrecisionDecision): ExactDecimal {
    const denominator = ExactDecimal.require(divisor);
    if (denominator.isZero()) throw new DecimalDivisionByZeroError();
    // Even when the quotient terminates, a requested precision is a distinct operation.
    const rounding =
      decision === undefined ? undefined : validateDecision(decision);
    const exact = terminatingQuotient(this.#value, denominator);
    if (exact !== null) {
      const result = ExactDecimal.from(exact);
      return decision === undefined ? result : result.quantize(decision);
    }
    if (decision === undefined || rounding === undefined) {
      throw new DecimalPrecisionAuthorityError();
    }
    // Clone isolates this one authorized decision from BigNumber's global division defaults.
    const LocalDecimal = BigNumber.clone({
      DECIMAL_PLACES: decision.decimalPlaces,
      ROUNDING_MODE: rounding,
    });
    return ExactDecimal.from(
      new LocalDecimal(this.toString()).dividedBy(divisor.toString()).toFixed(),
    );
  }

  /** Explicit rounding is never performed by ordinary arithmetic. */
  quantize(decision: PrecisionDecision): ExactDecimal {
    return ExactDecimal.from(
      this.#value
        .decimalPlaces(decision.decimalPlaces, validateDecision(decision))
        .toFixed(),
    );
  }

  toString(): string {
    return this.#value.toFixed();
  }

  valueOf(): never {
    throw new TypeError(
      "Exact decimals cannot be coerced into JavaScript numbers",
    );
  }

  [Symbol.toPrimitive](hint: string): string {
    if (hint === "string") return this.toString();
    throw new TypeError(
      "Exact decimals cannot be coerced into JavaScript numbers",
    );
  }
}
