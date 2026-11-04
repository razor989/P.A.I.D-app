/** A02 source-owned narrative. One sentence and visual action per reading beat. */
export const c03Explanation = Object.freeze({
  "EXP-01": Object.freeze([
    "Nico has finished his regular workday. There are two extra hours on his record.",
    "His regular hourly rate is ₱100. We will keep that rate the same.",
    "Keep the two extra hours, too. Now imagine those hours on two different kinds of day.",
    "One is an ordinary working day. The other is a rest day. Will those two hours earn the same overtime pay?",
  ]),
  "EXP-02": Object.freeze([
    "Open the ordinary-day record. The kind of day tells us which overtime multiplier to use.",
    "For this ordinary working day, the approved multiplier is 1.25.",
    "Follow one extra hour: ₱100 × 1.25 gives ₱125. The extension shows the amount above the regular hourly rate.",
    "There are two extra hours, each paid at that overtime rate.",
    "Together they earn ₱250 in overtime pay: ₱100 × 1.25 × 2. Regular pay is not included here.",
  ]),
  "EXP-03": Object.freeze([
    "Now switch the day marker to rest day. Leave the hourly rate and the two hours where they are.",
    "The approved rest-day overtime multiplier is 1.69. It belongs to this condition, not to a change in hours.",
    "At ₱100 an hour, that multiplier gives ₱169 for each overtime hour.",
    "Two hours now earn ₱338 in overtime pay. Watch the pay extend while the hour marks stay put.",
    "Switch between the days. Only the condition, its multiplier and the overtime pay change together.",
  ]),
  "EXP-04": Object.freeze([
    "Put the two records beside each other. Both start with ₱100 an hour and two extra hours.",
    "The ordinary-day record gives ₱250 in overtime pay.",
    "The rest-day record gives ₱338. Both bars use the same peso scale.",
    "Line up the bars. The rest-day payment extends ₱88 beyond the ordinary-day payment: ₱338 − ₱250.",
    "Those extra pesos did not come from more hours. They came from the different overtime condition and multiplier.",
  ]),
  "EXP-05": Object.freeze([
    "Both records follow the same calculation. Begin with the regular hourly rate.",
    "Multiply by the overtime multiplier for that kind of day.",
    "Then multiply by the number of overtime hours.",
    "Overtime pay = regular hourly rate × applicable overtime multiplier × overtime hours.",
    "The formula works only after you identify the day. Now use the two records to make your own comparison.",
  ]),
});
