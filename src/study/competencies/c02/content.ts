/** Literal FINAL-CONTENT-COPY-SPECIFICATION.md §§11.0, 11.2.
 * GLO identifiers are canonical; c02/... keys are technical role lookups only.
 * Feedback text does not authorize pre-check exposure.
 */
export const c02Copy = Object.freeze({
  "GLO-08-C02":
    "Start with gross income, determine the applicable deductions, and find net pay.",
  "GLO-09-C02":
    "Different deductions can use different approved bases, rates, floors, caps, brackets, or rules. Determine each applicable deduction before finding total deductions and net pay.",
  "c02/S01/scenario":
    "Anna is a private-sector employee. Her established monthly gross income is ₱12,100.00. Her payroll contains employee deductions for SSS, PhilHealth, Pag-IBIG, and withholding tax.",
  "c02/S01/task":
    "Identify the starting gross income, each individual deduction, total deductions, and Anna's final take-home pay.",
  "c02/S01/relationship-help":
    "Keep the payroll roles separate: gross income is the starting amount; each deduction is an individual subtraction; total deductions combine those deductions; net pay is gross income minus total deductions.",
  "c02/S01/confirmation":
    "Confirmed. SSS is ₱600.00, PhilHealth is ₱302.50, Pag-IBIG is ₱200.00, and withholding tax is ₱0.00. Total deductions are ₱1,102.50, so net pay is ₱10,997.50.",
  "c02/S01/reconsider-payroll-role":
    "Check whether you are identifying gross income, one deduction, total deductions, or net pay. These are different payroll roles.",
  "c02/S01/reconsider-arithmetic":
    "Add the four employee deductions before subtracting the total from ₱12,100.00 gross income.",
  "c02/S01/completion":
    "Activity complete. Anna's total deductions are ₱1,102.50 and her net pay is ₱10,997.50.",
  "c02/S01/accessibility-summary":
    "Gross income ₱12,100.00. SSS ₱600.00. PhilHealth ₱302.50. Pag-IBIG ₱200.00. Withholding tax ₱0.00. Total deductions ₱1,102.50. Net pay ₱10,997.50.",
  "c02/S01-F/scenario":
    "For this PhilHealth check, the employee's established monthly basic salary is ₱8,000.00. The approved PhilHealth minimum contribution basis is ₱10,000.00.",
  "c02/S01-F/task":
    "Identify the contribution basis that applies and determine the employee share at 2.5%.",
  "c02/S01-F/relationship-help":
    "Because ₱8,000.00 is below the approved ₱10,000.00 floor, use ₱10,000.00 as the contribution basis.",
  "c02/S01-F/confirmation":
    "Confirmed. The contribution basis is ₱10,000.00, so the employee share is ₱250.00.",
  "c02/S01-F/reconsider":
    "Do not calculate ₱8,000.00 × 2.5%. That gives ₱200.00 and ignores the approved PhilHealth floor.",
  "c02/S01-F/accessibility-summary":
    "Monthly basic salary ₱8,000.00. PhilHealth minimum contribution basis ₱10,000.00. Employee share at 2.5%: ₱250.00.",
  "c02/S02/scenario":
    "James's monthly gross income has already been established as ₱12,937.50. His regular monthly pay is ₱12,000.00, and his established overtime pay is ₱937.50.",
  "c02/S02/provider-callout":
    "Established gross income: ₱12,937.50, from Gross Income. C02 does not recompute the regular pay or overtime pay that produced it.",
  "c02/S02/task":
    "Explore why the statutory deductions do not all use the same numerical basis. Then determine total deductions and net pay.",
  "c02/S02/relationship-help":
    "Gross income is not a universal deduction basis. SSS uses the applicable MSC relationship, PhilHealth uses the established monthly basic/regular salary basis, and Pag-IBIG applies its approved cap.",
  "c02/S02/confirmation":
    "Confirmed. SSS is ₱650.00, PhilHealth is ₱300.00, Pag-IBIG is ₱200.00, and BIR withholding is ₱0.00. Total deductions are ₱1,150.00, so net pay is ₱11,787.50.",
  "c02/S02/reconsider-basis":
    "Check the basis for the deduction you are calculating. Do not use ₱12,937.50 as the basis for every deduction.",
  "c02/S02/reconsider-ownership":
    "Use James's established gross income as the C02 starting amount. Do not recompute his regular pay or overtime pay here.",
  "c02/S02/completion":
    "Activity complete. Different deductions can use different approved bases even when they belong to the same payroll. James's net pay is ₱11,787.50.",
  "c02/S02/accessibility-summary":
    "Gross income ₱12,937.50. Regular/basic pay ₱12,000.00. SSS ₱650.00, PhilHealth ₱300.00, Pag-IBIG ₱200.00, BIR ₱0.00. Total deductions ₱1,150.00. Net pay ₱11,787.50.",
  "c02/S03/scenario":
    "Fletcher is an ordinary government employee with an established monthly basic salary and gross income of ₱24,000.00. His employee deductions follow the government/GSIS branch.",
  "c02/S03/task":
    "Determine each applicable statutory deduction, total deductions, and Fletcher's final net pay.",
  "c02/S03/relationship-help":
    "For this approved government-payroll scenario, use the GSIS branch together with the established PhilHealth, Pag-IBIG, and monthly BIR rules. Do not substitute the private-sector SSS branch.",
  "c02/S03/confirmation":
    "Confirmed. GSIS is ₱2,160.00, PhilHealth is ₱600.00, Pag-IBIG is ₱200.00, and BIR withholding is ₱31.05. Total deductions are ₱2,991.05, so net pay is ₱21,008.95.",
  "c02/S03/reconsider-branch":
    "Fletcher is in the approved government/GSIS branch. Do not replace GSIS with SSS.",
  "c02/S03/reconsider-BIR":
    "After GSIS, PhilHealth, and Pag-IBIG, the taxable compensation used for the approved monthly BIR calculation is ₱21,040.00. Apply 15% only to the excess above ₱20,833.00.",
  "c02/S03/reconsider-corrected-oracle":
    "Use the approved BIR result ₱31.05. Do not use the superseded rounded values ₱31.00, ₱2,991.00, or ₱21,009.00.",
  "c02/S03/completion":
    "Activity complete. Fletcher's total deductions are ₱2,991.05 and his net pay is ₱21,008.95.",
  "c02/S03/accessibility-summary":
    "Government payroll. Gross and basic salary ₱24,000.00. GSIS ₱2,160.00. PhilHealth ₱600.00. Pag-IBIG ₱200.00. BIR ₱31.05. Total deductions ₱2,991.05. Net pay ₱21,008.95.",
  "c02/S04/scenario":
    "Alex is comparing two ordinary private-sector job offers. Both have ₱28,000.00 gross monthly income. Job A has a ₱25,000.00 monthly basic salary plus a ₱3,000.00 explicitly non-taxable allowance. Job B has a ₱28,000.00 monthly basic salary with no additional allowance.",
  "c02/S04/task":
    "Determine the statutory deductions and net pay for both offers. Then explain why equal gross income does not produce equal take-home pay.",
  "c02/S04/relationship-help":
    "The two jobs have the same gross income, but their composition and approved deduction bases differ. Compare the bases before comparing the final net pay.",
  "c02/S04/confirmation":
    "Confirmed. Job A has ₱2,516.30 total deductions and ₱25,483.70 net pay. Job B has ₱3,030.05 total deductions and ₱24,969.95 net pay. Equal gross income does not guarantee equal take-home pay when the composition and deduction bases differ.",
  "c02/S04/reconsider-comparison":
    "Do not stop at the equal ₱28,000.00 gross amounts. Compare the basic salary, non-taxable allowance, deduction bases, and resulting deductions.",
  "c02/S04/reconsider-Job-A":
    "Job A uses SSS ₱1,400.00, PhilHealth ₱625.00, Pag-IBIG ₱200.00, and BIR ₱291.30.",
  "c02/S04/reconsider-Job-B":
    "Job B uses SSS ₱1,400.00, PhilHealth ₱700.00, Pag-IBIG ₱200.00, and BIR ₱730.05.",
  "c02/S04/completion":
    "Activity complete. The two offers have the same gross income but different deduction bases and different net pay.",
  "c02/S04/accessibility-summary":
    "Job A: gross ₱28,000.00; basic ₱25,000.00 plus ₱3,000.00 explicitly non-taxable allowance; total deductions ₱2,516.30; net pay ₱25,483.70. Job B: gross and basic ₱28,000.00; total deductions ₱3,030.05; net pay ₱24,969.95.",
} as const);

export type C02CopyKey = keyof typeof c02Copy;
