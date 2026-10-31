/** Literal FINAL-CONTENT-COPY-SPECIFICATION.md §§11.0, 11.4.
 * GLO IDs are source identities; c04/Sxx/role strings are local lookup keys.
 * Answer-bearing roles remain role-scoped; this module does not reveal them.
 */
/** V4 diagnostic invitations are separate from preserved v3 teaching prompts. */
export const c04PrepareDiagnosticPrompts = Object.freeze([
  Object.freeze({
    title: "Where would you begin?",
    prompt:
      "Which statement would you use as Maya’s original salary—the amount you’d start with when looking for a change?",
  }),
  Object.freeze({
    title: "Which is the new salary?",
    prompt:
      "Now look at both statements again. Which would you call Maya’s new salary?",
  }),
  Object.freeze({
    title: "What difference do you notice?",
    prompt:
      "What amount would you choose for the difference between Maya’s two salaries? Go with what makes sense to you now.",
  }),
  Object.freeze({
    title: "What do you think happened?",
    prompt:
      "How would you describe Maya’s salary after the review? Choose the statement closest to what you think.",
  }),
]);
export const c04Copy = Object.freeze({
  "GLO-08-C04":
    "Compare an original value and a new value using the original value as the reference for percentage change.",
  "GLO-09-C04":
    "Identify the original value first, determine the difference, then compare that difference with the original value and interpret the direction of change.",
  "c04/S01/scenario":
    "Maya's monthly salary before her company's salary review was ₱18,000.00. After the review, her monthly salary remains ₱18,000.00.",
  "c04/S01/task":
    "Identify the original value and the new value. Determine the difference and describe what happened to the salary.",
  "c04/S01/relationship-help":
    "The original value remains the reference basis even when the original and new amounts are numerically equal.",
  "c04/S01/confirmation":
    "Confirmed. Original value: ₱18,000.00. New value: ₱18,000.00. Difference: ₱0.00. Percentage change: 0%. There is no percentage change.",
  "c04/S01/reconsider-roles":
    "Identify which amount is the original reference and which is the new value. Equal amounts can still have different mathematical roles.",
  "c04/S01/reconsider-interpretation":
    "A zero difference relative to the nonzero original value gives 0% change, which means no change.",
  "c04/S01/completion":
    "Activity complete. Maya's salary has no percentage change: 0%.",
  "c04/S01/accessibility-summary":
    "Original salary ₱18,000.00. New salary ₱18,000.00. Difference ₱0.00. Percentage change 0%. Interpretation: no change.",
  "c04/S01/guided-q1-title": "Which statement gives the Original salary?",
  "c04/S01/guided-q1-prompt":
    "Choose the statement that describes Maya's salary before the review.",
  "c04/S01/guided-q2-title": "Which statement gives the New salary?",
  "c04/S01/guided-q2-prompt":
    "Choose the statement that describes Maya's salary after the review.",
  "c04/S01/guided-q3-title": "What is New minus Original?",
  "c04/S01/guided-q3-prompt":
    "Compare the two amounts on the same peso scale, then choose the difference.",
  "c04/S01/guided-q4-title": "What happened to Maya's monthly salary?",
  "c04/S01/guided-q4-prompt":
    "Choose the interpretation supported by your comparison.",
  "c04/S01/guided-reconsider":
    "Reconsider your selections. Use the timing of each statement to identify Original and New, then compare the two amounts to find New minus Original and interpret the result.",
  "c04/S02/scenario":
    "Two employees each receive a ₱2,000.00 monthly salary increase. Employee A changes from ₱20,000.00 to ₱22,000.00. Employee B changes from ₱10,000.00 to ₱12,000.00.",
  "c04/S02/task":
    "Compare the two changes. Both employees gained the same number of pesos, but did their salaries increase by the same percentage?",
  "c04/S02/relationship-help":
    "Percentage change compares the difference with the original value. The same absolute increase can represent different relative changes when the original values differ.",
  "c04/S02/confirmation":
    "Confirmed. Employee A: ₱2,000.00 increase relative to ₱20,000.00 = 10% increase. Employee B: ₱2,000.00 increase relative to ₱10,000.00 = 20% increase.",
  "c04/S02/reconsider-denominator":
    "Use each employee's own original salary as the reference denominator.",
  "c04/S02/reconsider-interpretation":
    "The absolute increases are equal, but the percentage increases are not equal because the original values differ.",
  "c04/S02/completion":
    "Activity complete. The same ₱2,000.00 increase represents 10% for Employee A and 20% for Employee B.",
  "c04/S02/accessibility-summary":
    "Employee A: original ₱20,000.00, new ₱22,000.00, increase ₱2,000.00, percentage increase 10%. Employee B: original ₱10,000.00, new ₱12,000.00, increase ₱2,000.00, percentage increase 20%.",
  "c04/S02/q1-title": "What changed in pesos?",
  "c04/S02/q1-prompt": "Compare the two salary increases.",
  "c04/S02/q1-hint":
    "Find New − Original for each employee. Do not compare the new salaries alone.",
  "c04/S02/q1-success":
    "Yes. ₱22,000 − ₱20,000 and ₱12,000 − ₱10,000 both give +₱2,000.",
  "c04/S02/q1-reconsider":
    "What would “more pesos” look like? Inspect each employee and compare the extra money, not the starting salaries.",
  "c04/S02/q1-total":
    "Are you using the new salary as the increase? Inspect what was there before, then find only what was added.",
  "c04/S02/q2-title": "Which calculation keeps the right reference?",
  "c04/S02/q2-prompt":
    "Choose the pair that compares each increase with its own original salary.",
  "c04/S02/q2-hint":
    "Use each employee’s own original salary as the reference denominator, not the new salary or the other employee’s salary.",
  "c04/S02/q2-success":
    "Yes. A uses the original ₱20,000; B uses the original ₱10,000. Each calculation uses the salary before the raise.",
  "c04/S02/q2-reconsider":
    "Your pair uses one shared reference. Did both employees start with that salary? Inspect each starting amount.",
  "c04/S02/q2-new":
    "Your comparison uses the amount after the raise. Which amount was there before the increase?",
  "c04/S02/q3-title": "Put the whole story together.",
  "c04/S02/q3-prompt": "Which statement explains both percentage increases?",
  "c04/S02/q3-hint":
    "Equal absolute increases need not be equal percentages. Check which original belongs beneath each ₱2,000 increase.",
  "c04/S02/q3-success":
    "Exactly. The starting salaries are different, so the same added money is a different share of each.",
  "c04/S02/q3-reconsider":
    "You linked the larger percentage to the higher salary. Keep the ₱2,000 raise fixed and reconsider which original it forms a larger share of.",
  "c04/S02/q3-equal":
    "You used equal peso increases to decide the percentages. Could the same increase take different shares of different starting salaries?",
  "c04/S03/scenario":
    "A company initially advertises a monthly salary of ₱30,000.00 for a position. Before the position is filled, the offer is revised to ₱27,000.00.",
  "c04/S03/task":
    "Determine the absolute change, calculate the percentage change using the original salary as the reference basis, and interpret the result.",
  "c04/S03/relationship-help":
    "Use the original ₱30,000.00 offer as the denominator. A negative difference indicates a decrease.",
  "c04/S03/confirmation":
    "Confirmed. The difference is −₱3,000.00. Relative to the ₱30,000.00 original offer, the percentage change is −10%, which means a 10% decrease.",
  "c04/S03/reconsider-reference":
    "Use the original offer, ₱30,000.00, as the reference denominator.",
  "c04/S03/reconsider-direction":
    "The new offer is lower than the original, so the signed change is negative and the learner-facing interpretation is a decrease.",
  "c04/S03/completion":
    "Activity complete. The offered monthly salary decreased by 10% from ₱30,000.00 to ₱27,000.00.",
  "c04/S03/accessibility-summary":
    "Original offer ₱30,000.00. New offer ₱27,000.00. Difference minus ₱3,000.00. Percentage change minus 10%. Interpretation: 10% decrease.",
  "c04/S04/scenario":
    "A job previously offered no monthly communication allowance, so the original allowance amount was ₱0.00. The employer later introduces a ₱1,500.00 monthly communication allowance.",
  "c04/S04/task":
    "Determine the absolute change. Then determine whether percentage change can be calculated using the approved original-value formula.",
  "c04/S04/relationship-help":
    "The absolute change can be calculated, but percentage change would require division by the original value. Here, the original value is zero.",
  "c04/S04/confirmation":
    "Confirmed. The absolute increase is ₱1,500.00. Percentage change relative to an original value of ₱0.00 is undefined, so no percentage result is reported.",
  "c04/S04/undefined-result":
    "Percentage change undefined. The original value is zero, so the approved percentage-change formula would require division by zero. The absolute increase is still ₱1,500.00.",
  "c04/S04/reconsider-prohibited-substitutions":
    "Do not report 0%, 100%, or infinity, and do not replace the original value with the new value as the denominator.",
  "c04/S04/completion":
    "Activity complete. The allowance increased by ₱1,500.00, while percentage change relative to the original zero value is undefined.",
  "c04/S04/accessibility-summary":
    "Original allowance ₱0.00. New allowance ₱1,500.00. Absolute increase ₱1,500.00. Percentage change is undefined because the original value is zero.",
} as const);

export type C04CopyKey = keyof typeof c04Copy;
