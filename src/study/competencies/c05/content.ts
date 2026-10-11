/* Verbatim UTF-8 §11.5 role rows and §11.0 GLO-08/09-C05; keys are local lookups. */
export const c05Copy = Object.freeze({
  "c05/S01/scenario":
    "An office clerk has an annual salary of ₱312,000.00. The clerk wants to know the equivalent weekly salary.",
  "c05/S01/task":
    "Before calculating, identify the given representation, the target representation, and the established time basis that connects them.",
  "c05/S01/relationship-help":
    "Given: ₱312,000.00 per year. Target: weekly salary. Established basis: 52 weeks per year. The direct relationship is annual salary ÷ 52.",
  "c05/S01/confirmation":
    "Confirmed. The given representation is annual salary, the target is weekly salary, and the established basis is 52 weeks per year. The guided equivalent is ₱6,000.00 per week.",
  "c05/S01/reconsider-representation":
    "First identify what is given and what is being asked for. Do not apply a conversion factor before identifying the target representation.",
  "c05/S01/reconsider-basis":
    "Use the established 52-weeks-per-year relationship for this annual-to-weekly conversion.",
  "c05/S01/completion":
    "Activity complete. Annual salary converts directly to weekly salary here using 52 weeks per year.",
  "c05/S01/accessibility-summary":
    "Given annual salary ₱312,000.00 per year. Target weekly salary. Basis 52 weeks per year. Guided weekly equivalent ₱6,000.00 per week.",
  "c05/S02/scenario":
    "A teacher has an annual salary of ₱480,000.00. Explore how that salary is represented as a monthly salary and how the established monthly salary is represented in each of two semi-monthly pay periods.",
  "c05/S02/task":
    "Compare the approved annual-to-monthly and monthly-to-semi-monthly relationships.",
  "c05/S02/relationship-help":
    "Annual to monthly uses 12 months per year. Monthly to semi-monthly uses 2 semi-monthly pay periods per month. These are two linked approved states, not a universal conversion ladder.",
  "c05/S02/confirmation":
    "Confirmed. ₱480,000.00 per year ÷ 12 = ₱40,000.00 per month. ₱40,000.00 per month ÷ 2 = ₱20,000.00 per semi-monthly pay period.",
  "c05/S02/reconsider-first-state":
    "For annual to monthly, use 12 months per year.",
  "c05/S02/reconsider-second-state":
    "For monthly to semi-monthly, use the established monthly value and 2 semi-monthly pay periods per month.",
  "c05/S02/completion":
    "Activity complete. The approved salary is represented as ₱40,000.00 per month and ₱20,000.00 per semi-monthly pay period.",
  "c05/S02/accessibility-summary":
    "Annual salary ₱480,000.00 per year. Monthly equivalent ₱40,000.00 using 12 months per year. Semi-monthly amount ₱20,000.00 using 2 pay periods per month.",
  "c05/S03/scenario": "A manager is offered an annual salary of ₱936,000.00.",
  "c05/S03/task":
    "Determine the equivalent weekly salary using the established annual-to-weekly relationship.",
  "c05/S03/relationship-help":
    "Given: ₱936,000.00 per year. Target: weekly salary. Basis: 52 weeks per year. Use annual salary ÷ 52.",
  "c05/S03/confirmation": "Confirmed. ₱936,000.00 ÷ 52 = ₱18,000.00 per week.",
  "c05/S03/reconsider-relationship":
    "Convert directly from annual to weekly using 52 weeks per year. Do not route through an unnecessary monthly or daily representation.",
  "c05/S03/reconsider-unit":
    "The result must be interpreted as a weekly salary, not a monthly or daily amount.",
  "c05/S03/completion":
    "Activity complete. The weekly equivalent of ₱936,000.00 per year is ₱18,000.00 per week.",
  "c05/S03/accessibility-summary":
    "Annual salary ₱936,000.00 per year. Target weekly salary. Basis 52 weeks per year. Weekly equivalent ₱18,000.00 per week.",
  "c05/S04/scenario":
    "A part-time worker earns ₱100.00 per hour. For the week in this scenario, the worker has 40 regular working hours.",
  "c05/S04/task":
    "Determine the worker's weekly wage for those 40 regular hours.",
  "c05/S04/relationship-help":
    "This conversion is schedule-dependent. Use the scenario-established 40 regular hours for this week: hourly rate × hours worked in the week.",
  "c05/S04/confirmation":
    "Confirmed. ₱100.00 per hour × 40 regular hours = ₱4,000.00 for the week.",
  "c05/S04/reconsider-basis":
    "Use the 40 regular hours explicitly established for this scenario. Do not treat 40 hours as a universal workweek.",
  "c05/S04/information-needed-boundary":
    "If the weekly hours were not established, weekly wage could not be determined from the hourly rate alone. The required weekly-hours basis would be information needed.",
  "c05/S04/completion":
    "Activity complete. Under the stated 40-hour schedule, the weekly wage is ₱4,000.00.",
  "c05/S04/accessibility-summary":
    "Hourly rate ₱100.00 per hour. Scenario-established weekly hours 40 regular hours. Weekly wage ₱4,000.00.",
  "c05/S05/scenario":
    "An employee's current daily wage is ₱4,000.00. For this compensation arrangement, the scenario explicitly establishes a 5-day workweek and the applicable 261-day annual factor.",
  "c05/S05/task":
    "Determine the monthly equivalent of the daily wage using the established basis.",
  "c05/S05/relationship-help":
    "Use the scenario-established 261-day annual factor and 12 months per year: monthly wage = daily wage × 261 ÷ 12. The 261-day factor is conditional to this approved scenario, not universal.",
  "c05/S05/confirmation":
    "Confirmed. ₱4,000.00 × 261 ÷ 12 = ₱87,000.00 per month.",
  "c05/S05/reconsider-basis":
    "Use the established 261-day annual factor for this scenario. Do not substitute an assumed work schedule or another annual factor.",
  "c05/S05/reconsider-target":
    "The target is a monthly equivalent. Preserve the monthly unit when interpreting the result.",
  "c05/S05/completion":
    "Activity complete. Under the established 5-day/261-day basis, the monthly equivalent is ₱87,000.00.",
  "c05/S05/accessibility-summary":
    "Daily wage ₱4,000.00 per day. Established 5-day workweek and 261-day annual factor. Monthly equivalent ₱87,000.00 per month.",
  "GLO-08-C05":
    "Convert a given wage or salary representation to the required target representation using the established relationship and basis.",
  "GLO-09-C05":
    "Identify what is given, what is needed, and any required time or schedule basis before applying the appropriate direct relationship.",
} as const);
