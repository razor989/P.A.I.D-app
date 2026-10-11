import {
  ExactDecimal,
  isProviderRead,
  isProviderRecordId,
  quantity,
} from "../../../core/public";
import type { ProviderProvenance, Quantity } from "../../../core/public";

/** Separate approved provider/review source, never a learner scenario or progress unit. */
export const c05James = Object.freeze({
  id: "C05-PV-JAMES-01",
  role: "James Regular-Pay Provider State",
  hourlyRate: quantity(
    ExactDecimal.from("75.00"),
    "MONETARY_RATE",
    "PHP",
    "per hour",
  ),
  regularHours: quantity(ExactDecimal.from("160"), "DURATION", "hour", null),
  establishedRegularPay: quantity(
    ExactDecimal.from("12000.00"),
    "MONETARY_AMOUNT",
    "PHP",
    null,
  ),
  provenance: Object.freeze({
    providerCompetencyId: "C05",
    consumerCompetencyId: "C01",
    sourceRecordId: "C05-PV-JAMES-01",
    sourceOutputKey: "wage/salary representation",
    relevantCondition: "established regular pay from 160 regular hours",
  } satisfies ProviderProvenance),
  hourlyRateProvenance: Object.freeze({
    providerCompetencyId: "C05",
    consumerCompetencyId: "C03",
    sourceRecordId: "C05-PV-JAMES-01",
    sourceOutputKey: "hourly-rate representation",
    relevantCondition: null,
  } satisfies ProviderProvenance),
});

const snapshot = (value: Quantity) => [
  value.magnitude.toString(),
  value.kind,
  value.unit,
  value.basis,
];

export function validateC05James(value: typeof c05James): void {
  if (
    !isProviderRecordId(value.id) ||
    value.role !== c05James.role ||
    !(value.hourlyRate.magnitude instanceof ExactDecimal) ||
    !(value.regularHours.magnitude instanceof ExactDecimal) ||
    !(value.establishedRegularPay.magnitude instanceof ExactDecimal) ||
    Object.keys(value.hourlyRate).length !== 4 ||
    Object.keys(value.regularHours).length !== 4 ||
    Object.keys(value.establishedRegularPay).length !== 4 ||
    JSON.stringify(snapshot(value.hourlyRate)) !==
      JSON.stringify(["75", "MONETARY_RATE", "PHP", "per hour"]) ||
    JSON.stringify(snapshot(value.regularHours)) !==
      JSON.stringify(["160", "DURATION", "hour", null]) ||
    JSON.stringify(snapshot(value.establishedRegularPay)) !==
      JSON.stringify(["12000", "MONETARY_AMOUNT", "PHP", null]) ||
    JSON.stringify(value.provenance) !== JSON.stringify(c05James.provenance) ||
    JSON.stringify(value.hourlyRateProvenance) !==
      JSON.stringify(c05James.hourlyRateProvenance) ||
    Object.keys(value).length !== Object.keys(c05James).length ||
    !isProviderRead({
      kind: "ESTABLISHED",
      provenance: value.provenance,
      result: {
        availability: "AVAILABLE",
        resolution: { kind: "KNOWN", value: value.establishedRegularPay },
      },
    }) ||
    !isProviderRead({
      kind: "ESTABLISHED",
      provenance: value.hourlyRateProvenance,
      result: {
        availability: "AVAILABLE",
        resolution: { kind: "KNOWN", value: value.hourlyRate },
      },
    })
  )
    throw new Error("C05 James provider-review mismatch");
}
