/** Final Amendment C C03 §§36–45. Task-owned semantic teaching input,
 * not a Study-bank edit or T062 presentation implementation. */
export const c03Explanation = Object.freeze({
  "EXP-01": Object.freeze([
    "Start with the parts of the overtime situation that are already established. The regular hourly rate is ₱100.00 per hour, and there are 2 overtime hours. The work condition tells us what kind of overtime situation those hours belong to.",
    "These quantities have different jobs. The hourly rate tells us the regular pay per hour. The overtime hours tell us how many overtime hours are being paid. The work condition determines which approved multiplier applies.",
  ]),
  "EXP-02": Object.freeze([
    "Now follow the condition before looking at the calculation. This overtime occurs on an ordinary working day. Under the approved condition table used by this activity, ordinary working-day overtime corresponds to a 1.25 multiplier.",
    "The learner does not choose 1.25 independently. The condition is established first; the multiplier follows from that condition.",
    "The rate stayed ₱100.00 per hour. The overtime hours stayed at 2. The ordinary working-day condition established the 1.25 multiplier, which produced ₱250.00 overtime pay.",
  ]),
  "EXP-03": Object.freeze([
    "Now change only the work condition. Keep the regular hourly rate at ₱100.00 per hour and the overtime hours at 2. Change the active condition from ordinary working day to rest day.",
    "The rest-day multiplier did not change because the learner adjusted the multiplier itself. It changed because the learner changed the approved work condition.",
    "The ₱100.00 regular hourly rate and 2 overtime hours remained fixed. That lets us isolate the condition as the cause of the different multiplier and overtime-pay result.",
  ]),
  "EXP-04": Object.freeze([
    "The two situations use the same regular hourly rate and the same number of overtime hours. The different result begins with the work condition.",
    "Ordinary working-day overtime maps to 1.25 and produces ₱250.00. Rest-day overtime maps to 1.69 and produces ₱338.00.",
    "The ₱88.00 difference is not caused by more overtime hours or a higher regular hourly rate. Those quantities were deliberately held constant. The difference results from the different approved overtime condition and its corresponding multiplier.",
  ]),
  "EXP-05": Object.freeze([
    "We can now state the overtime-pay relationship formally. Once the regular hourly rate, overtime condition, condition-linked multiplier, and overtime hours are established:",
    "Overtime Pay = Regular Hourly Rate × Applicable Overtime Multiplier × Overtime Hours",
    "The equation does not eliminate the need to identify the condition. The multiplier inside the equation comes from that condition.",
    "So the reasoning order remains: identify the work condition, obtain the multiplier that belongs to it, and then perform the overtime-pay calculation.",
  ]),
});
