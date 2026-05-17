/** Shown in the thank-you page tooltip (keep in sync with rankingAccuracy.ts). */
export const ACCURACY_CALCULATION_TOOLTIP =
    "For each of the 5 tasks, we compare your author ordering to the published byline order. " +
    "We compute Kendall's tau (τ), which measures agreement between two orderings, then convert it to a " +
    "0–100% score using (τ + 1) ÷ 2 so that perfect agreement is 100% and complete disagreement is 0%. " +
    "Authors with equal contributions (marked in our data) may appear in either order without lowering " +
    "your score—for example, if the correct order is A, B*, C*, D, both ABCD and ACBD score 100% on that task. " +
    "Your block accuracy is the average of those five task scores. If you complete more than one block, " +
    "we also show your average across all blocks you have finished."
