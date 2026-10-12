/* Verbatim UTF-8 final-copy specification §§11.6 and 11.0; scenario keys are local lookups. */
export const c06Copy = Object.freeze({
  "c06/S01/scenario":
    "Two sales workers have different compensation arrangements. Worker A earns 5% commission on ₱80,000.00 in sales and receives no base salary as part of the arrangement. Worker B receives a ₱10,000.00 monthly base salary plus 5% commission on ₱80,000.00 in sales.",
  "c06/S01/task":
    "Identify which worker is under straight commission and which is under base-plus-commission. Then identify which quantities belong in each arrangement.",
  "c06/S01/relationship-help":
    "Straight commission has no base-salary branch in this approved arrangement. Base-plus-commission combines the base salary with commission after the commission is determined.",
  "c06/S01/confirmation":
    "Confirmed. Worker A is under straight commission: commission is ₱4,000.00 and base salary is not applicable. Worker B is under base-plus-commission: commission is ₱4,000.00, base salary is ₱10,000.00, and total compensation is ₱14,000.00.",
  "c06/S01/reconsider-arrangement":
    "Check whether the arrangement includes a base salary. Worker A has no base salary as part of the arrangement; Worker B does.",
  "c06/S01/reconsider-not-applicable":
    "For Worker A, base salary is not applicable. Do not represent that state as a numerical ₱0.00 base salary.",
  "c06/S01/completion":
    "Activity complete. Straight commission and base-plus-commission use different compensation structures even when the sales base and commission rate are the same.",
  "c06/S01/accessibility-summary":
    "Worker A: straight commission, sales ₱80,000.00, rate 5%, commission ₱4,000.00, base salary not applicable. Worker B: base-plus-commission, sales ₱80,000.00, rate 5%, commission ₱4,000.00, base salary ₱10,000.00, total compensation ₱14,000.00.",
  "c06/S02/scenario":
    "A sales representative has a base-plus-commission arrangement consisting of a ₱15,000.00 monthly base salary plus a 3% commission on monthly sales. Compare Situation A with ₱300,000.00 in sales and Situation B with ₱500,000.00 in sales.",
  "c06/S02/task":
    "Observe what changes in the commission and total compensation when sales change while the base salary and commission rate remain the same.",
  "c06/S02/relationship-help":
    "The commission uses sales × rate. The base salary stays fixed at ₱15,000.00 and does not enter the commission formula.",
  "c06/S02/confirmation":
    "Confirmed. Situation A: ₱9,000.00 commission and ₱24,000.00 total compensation. Situation B: ₱15,000.00 commission and ₱30,000.00 total compensation.",
  "c06/S02/reconsider-invariant-values":
    "Keep the base salary at ₱15,000.00 and the commission rate at 3% in both situations. Only the sales amount changes.",
  "c06/S02/reconsider-formula":
    "Calculate commission from sales × rate first. Add the fixed base salary only when determining total compensation.",
  "c06/S02/completion":
    "Activity complete. With the same 3% rate and ₱15,000.00 base salary, higher sales produce a higher commission and therefore a higher total compensation.",
  "c06/S02/accessibility-summary":
    "Base-plus-commission arrangement. Base salary ₱15,000.00 and rate 3% in both situations. Situation A sales ₱300,000.00, commission ₱9,000.00, total ₱24,000.00. Situation B sales ₱500,000.00, commission ₱15,000.00, total ₱30,000.00.",
  "c06/S03/scenario":
    "A real estate agent works under a straight-commission arrangement. The agent earns 5% commission on all sales and closes a property sale worth ₱2,000,000.00.",
  "c06/S03/task":
    "Identify the sales base and commission rate, then determine the agent's commission.",
  "c06/S03/relationship-help":
    "For straight commission, commission = sales × rate. No base salary is part of this approved arrangement.",
  "c06/S03/confirmation":
    "Confirmed. ₱2,000,000.00 × 5% = ₱100,000.00 commission. Base salary is not applicable.",
  "c06/S03/reconsider-arrangement":
    "This is a straight-commission arrangement. Do not add a base-salary branch.",
  "c06/S03/reconsider-rate":
    "Convert 5% to 0.05 when using multiplication, then apply it to the ₱2,000,000.00 sales base.",
  "c06/S03/completion":
    "Activity complete. The agent's commission is ₱100,000.00.",
  "c06/S03/accessibility-summary":
    "Straight commission. Sales base ₱2,000,000.00. Commission rate 5%. Base salary not applicable. Commission ₱100,000.00.",
  "c06/S04/scenario":
    "Lina is a sales associate at a small appliance store. Her June compensation arrangement provides a ₱15,000.00 monthly base salary plus a 3% commission on June sales. Lina's June sales total ₱120,000.00.",
  "c06/S04/task":
    "Identify the compensation arrangement, determine Lina's June commission, and then determine the base-plus-commission total compensation.",
  "c06/S04/relationship-help":
    "Calculate commission from sales × rate, then add the established base salary for the C06 total. C06 stops at the base-plus-commission total and does not add C01-only earnings.",
  "c06/S04/confirmation":
    "Confirmed. ₱120,000.00 × 3% = ₱3,600.00 commission. ₱15,000.00 base salary + ₱3,600.00 commission = ₱18,600.00 base-plus-commission total compensation.",
  "c06/S04/provider-note":
    "Established output for downstream Gross Income: commission, ₱3,600.00. Gross Income may use this value without recalculating the commission relationship.",
  "c06/S04/reconsider-scope":
    "Do not add the ₱800.00 communication allowance from the separate C01 scenario here. C06's approved total is ₱18,600.00, and its downstream output is the ₱3,600.00 commission.",
  "c06/S04/completion":
    "Activity complete. Lina's June commission is ₱3,600.00 and her base-plus-commission total compensation is ₱18,600.00.",
  "c06/S04/accessibility-summary":
    "Base-plus-commission arrangement. Sales ₱120,000.00. Rate 3%. Commission ₱3,600.00. Base salary ₱15,000.00. C06 total compensation ₱18,600.00. Commission ₱3,600.00 is the established downstream output for Gross Income.",
  "GLO-08-C06":
    "Determine commission from sales and an applicable rate, and distinguish straight commission from base-plus-commission.",
  "GLO-09-C06":
    "Identify the compensation arrangement, sales base, and commission rate first. Include a base salary only when the established arrangement provides one.",
} as const);
