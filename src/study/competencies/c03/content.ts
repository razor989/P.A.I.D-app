/** Literal FINAL-CONTENT-COPY-SPECIFICATION.md §§11.0, 11.3.
 * GLO IDs are canonical; c03/Sxx/role keys are task-local lookups, NOT source IDs.
 * Feedback and completion roles do not authorize premature answer exposure.
 */
export const c03Copy = Object.freeze({
  "GLO-08-C03":
    "Use the overtime condition to identify the applicable multiplier and determine overtime pay.",
  "GLO-09-C03":
    "Keep the regular hourly rate, overtime hours, condition, and multiplier distinct. The overtime condition determines which approved multiplier applies.",
  "c03/S01/scenario":
    "Nico is a covered private-sector employee with an established regular hourly rate of ₱100.00 per hour. On an ordinary working day, he finishes his regular eight hours of work and then works 2 additional hours.",
  "c03/S01/task":
    "Before calculating overtime pay, identify the overtime condition and the multiplier that follows from it.",
  "c03/S01/relationship-help":
    "The overtime condition determines the multiplier. Ordinary working-day overtime uses the approved 1.25 multiplier.",
  "c03/S01/confirmation":
    "Confirmed. The condition is ordinary working-day overtime, so the multiplier is 1.25. With 2 overtime hours at ₱100.00 per hour, the corresponding overtime pay is ₱250.00.",
  "c03/S01/reconsider-condition":
    "Identify the work condition first. This scenario states that the overtime occurs on an ordinary working day.",
  "c03/S01/reconsider-multiplier":
    "Use the multiplier that belongs to the established condition. The hourly rate and the multiplier are different quantities.",
  "c03/S01/completion":
    "Activity complete. Ordinary working-day overtime uses the 1.25 multiplier in this approved scenario.",
  "c03/S01/accessibility-summary":
    "Regular hourly rate ₱100.00 per hour. Condition: ordinary working-day overtime. Multiplier 1.25. Overtime hours 2. Corresponding overtime pay ₱250.00.",
  "c03/S02/scenario":
    "Two approved work situations use the same regular hourly rate of ₱100.00 per hour and the same 2 overtime hours. Situation A occurs on an ordinary working day. Situation B occurs on the employee's rest day.",
  "c03/S02/task":
    "Compare how the overtime condition changes the multiplier and the resulting overtime pay.",
  "c03/S02/relationship-help":
    "The rate and overtime hours stay the same. Only the work condition changes, so the applicable multiplier changes.",
  "c03/S02/confirmation":
    "Confirmed. Ordinary working-day overtime uses 1.25 and gives ₱250.00. Rest-day overtime uses 1.69 and gives ₱338.00. The difference in overtime pay is ₱88.00.",
  "c03/S02/reconsider-invariant-values":
    "Keep the ₱100.00 hourly rate and 2 overtime hours the same in both situations.",
  "c03/S02/reconsider-condition":
    "Use 1.25 for the ordinary working day and 1.69 for the rest day. The condition is what changes the multiplier.",
  "c03/S02/completion":
    "Activity complete. With the same hourly rate and overtime hours, a different approved overtime condition can produce a different multiplier and overtime-pay result.",
  "c03/S02/accessibility-summary":
    "Situation A: ordinary working day, rate ₱100.00 per hour, 2 overtime hours, multiplier 1.25, overtime pay ₱250.00. Situation B: rest day, same rate and hours, multiplier 1.69, overtime pay ₱338.00. Difference ₱88.00.",
  "c03/S03/scenario":
    "James has an established regular hourly rate of ₱75.00 per hour. During the month, he works 10 overtime hours after his regular hours on ordinary working days.",
  "c03/S03/task":
    "Identify the applicable overtime multiplier and determine James's overtime pay.",
  "c03/S03/relationship-help":
    "Use the chain: ordinary working-day condition → 1.25 multiplier → regular hourly rate × multiplier × overtime hours.",
  "c03/S03/confirmation":
    "Confirmed. Ordinary working-day overtime uses 1.25. ₱75.00 × 1.25 × 10 = ₱937.50 overtime pay.",
  "c03/S03/reconsider-condition":
    "James's overtime occurs on ordinary working days. Use the multiplier for that condition.",
  "c03/S03/reconsider-boundary":
    "Stop at overtime pay. Do not add regular pay or continue into gross income in this activity.",
  "c03/S03/completion": "Activity complete. James's overtime pay is ₱937.50.",
  "c03/S03/accessibility-summary":
    "Regular hourly rate ₱75.00 per hour. Ordinary working-day overtime. Multiplier 1.25. Overtime hours 10. Overtime pay ₱937.50.",
  "c03/S04/scenario":
    "Mara is a covered private-sector employee. Her regular hourly rate has already been established as ₱120.00 per hour. On a day established by the scenario as a regular holiday, she works 3 hours beyond the first eight hours.",
  "c03/S04/task":
    "Identify the overtime condition, identify the multiplier that follows from that condition, and calculate Mara's overtime pay for the 3 overtime hours.",
  "c03/S04/relationship-help":
    "The regular-holiday condition determines the approved 2.60 overtime multiplier. The hourly rate is already established and is not converted in this activity.",
  "c03/S04/confirmation":
    "Confirmed. The condition is regular-holiday overtime, so the multiplier is 2.60. ₱120.00 × 2.60 × 3 = ₱936.00 overtime pay.",
  "c03/S04/reconsider-condition":
    "The scenario establishes a regular holiday. Use the overtime multiplier for that condition.",
  "c03/S04/reconsider-scope":
    "The ₱936.00 result is overtime pay for the three overtime hours, not total holiday earnings, gross income, or net pay.",
  "c03/S04/completion":
    "Activity complete. Mara's overtime pay for the 3 regular-holiday overtime hours is ₱936.00.",
  "c03/S04/accessibility-summary":
    "Established regular hourly rate ₱120.00 per hour. Condition: regular-holiday overtime. Multiplier 2.60. Overtime hours 3. Overtime pay ₱936.00.",
} as const);

export type C03CopyKey = keyof typeof c03Copy;
