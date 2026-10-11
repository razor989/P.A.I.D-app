/** Literal source copy: FINAL-CONTENT-COPY-SPECIFICATION.md §§11.0–11.1.
 * GLO IDs are canonical; c01/Sxx/role keys are task-local lookups, NOT source IDs.
 * Feedback is role-scoped data; this module does not authorize early display.
 */
export const c01Copy = Object.freeze({
  "GLO-08-C01":
    "Identify which earnings apply and combine them to determine gross income before deductions.",
  "GLO-09-C01":
    "Work with the earnings established for the current pay period and combine only the amounts that belong in gross income.",
  "c01/S01/scenario":
    "Mika is reviewing her earnings for April. Her April base salary is ₱18,000.00. Her contract also provides a ₱1,200.00 meal allowance that is part of her April earnings. A ₱900.00 overtime payment shown in her records belongs to March and was already paid in March.",
  "c01/S01/task":
    "Which amounts belong in Mika's April gross income before deductions? Identify the applicable April earnings, leave out the item that belongs to another period, and determine the total.",
  "c01/S01/relationship-help":
    "Gross income combines the earnings that apply to the same pay period before deductions. An earning does not belong in April's total merely because it appears in the record.",
  "c01/S01/confirmation":
    "Confirmed. The April base salary and meal allowance apply to April, while the ₱900.00 overtime payment belongs to March. ₱18,000.00 + ₱1,200.00 = ₱19,200.00 gross income.",
  "c01/S01/reconsider-period-applicability":
    "Check the pay period for each earning. The overtime payment belongs to March, not April.",
  "c01/S01/reconsider-total":
    "Add only the earnings established as applicable to April. Do not include the March overtime payment.",
  "c01/S01/completion":
    "Activity complete. Mika's April gross income is ₱19,200.00 before deductions. Gross income uses the earnings that apply to the current pay period.",
  "c01/S01/accessibility-summary":
    "April earnings: base salary ₱18,000.00, applicable; meal allowance ₱1,200.00, applicable; overtime payment ₱900.00, March, not applicable to April. April gross income: ₱19,200.00 before deductions.",
  "c01/S02/scenario":
    "Paolo works at a neighborhood printing shop. For May, his regular pay is ₱17,250.00. He also receives a ₱1,750.00 transportation allowance, and his employer states that this allowance is included as part of his May earnings.",
  "c01/S02/task":
    "Build Paolo's May gross-income total using the earnings that apply. Observe how the applicable amounts combine before deductions.",
  "c01/S02/relationship-help":
    "The scenario establishes both the regular pay and transportation allowance as applicable May earnings. Their values combine to form gross income.",
  "c01/S02/confirmation":
    "Confirmed. Both May earnings apply: ₱17,250.00 regular pay + ₱1,750.00 transportation allowance = ₱19,000.00 gross income.",
  "c01/S02/reconsider-applicability":
    "Use the scenario's stated applicability. The transportation allowance is explicitly included as part of Paolo's May earnings.",
  "c01/S02/reconsider-total":
    "Gross income is the sum of the applicable earnings shown for May.",
  "c01/S02/completion":
    "Activity complete. Paolo's May gross income is ₱19,000.00 before deductions.",
  "c01/S02/accessibility-summary":
    "May earnings: regular pay ₱17,250.00 and transportation allowance ₱1,750.00, both applicable. Gross income: ₱19,000.00 before deductions.",
  "c01/S03/scenario":
    "James's regular pay for the month has already been established as ₱12,000.00. His overtime pay for the same month has already been established as ₱937.50.",
  "c01/S03/provider-callout":
    "Established inputs: regular pay, ₱12,000.00, from Wage and Salary Representation and Conversion; overtime pay, ₱937.50, from Overtime Pay.",
  "c01/S03/task":
    "Determine James's gross income before deductions using the established regular pay and overtime pay. Then explain what the total represents.",
  "c01/S03/relationship-help":
    "C01 combines the established earnings. It does not recompute how the regular pay or overtime pay was obtained.",
  "c01/S03/confirmation":
    "Confirmed. ₱12,000.00 regular pay + ₱937.50 overtime pay = ₱12,937.50 gross income. This is James's total applicable earnings for the month before deductions.",
  "c01/S03/reconsider-ownership":
    "Use the established regular-pay and overtime-pay amounts as inputs. Do not recalculate their provider relationships in this activity.",
  "c01/S03/reconsider-total":
    "Gross income combines both established earnings before deductions.",
  "c01/S03/completion":
    "Activity complete. James's gross income is ₱12,937.50 before deductions.",
  "c01/S03/accessibility-summary":
    "Established regular pay: ₱12,000.00, provided by Wage and Salary Representation and Conversion. Established overtime pay: ₱937.50, provided by Overtime Pay. Gross income: ₱12,937.50 before deductions.",
  "c01/S04/scenario":
    "Lina works as a sales associate at a small appliance store. For June, her monthly base salary is ₱15,000.00. Her June commission has already been established as ₱3,600.00. She also receives an ₱800.00 communication allowance that her employer states is included as part of her June earnings.",
  "c01/S04/provider-callout":
    "Established input: commission, ₱3,600.00, from Commission.",
  "c01/S04/task":
    "Determine Lina's June gross income before deductions. Identify the earnings that belong in the total and explain what the result means.",
  "c01/S04/relationship-help":
    "Use the established commission amount as an input. C01 owns the gross-income composition, not the commission calculation.",
  "c01/S04/confirmation":
    "Confirmed. ₱15,000.00 base salary + ₱3,600.00 commission + ₱800.00 communication allowance = ₱19,400.00 gross income.",
  "c01/S04/reconsider-ownership":
    "Use the established ₱3,600.00 commission. Do not recompute sales × commission rate in this activity.",
  "c01/S04/reconsider-composition":
    "All three amounts are established as applicable June earnings. Include each one in the gross-income total.",
  "c01/S04/completion":
    "Activity complete. Lina's June gross income is ₱19,400.00 before deductions.",
  "c01/S04/accessibility-summary":
    "June earnings: base salary ₱15,000.00; established commission ₱3,600.00 from Commission; communication allowance ₱800.00. All three are applicable. Gross income: ₱19,400.00 before deductions.",
} as const);

export type C01CopyKey = keyof typeof c01Copy;
