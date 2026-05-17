import { describe, expect, it } from "vitest"
import { shouldShowExperimentThanksScreen } from "@/lib/survey/experimentCompletion"

describe("shouldShowExperimentThanksScreen", () => {
    it("returns false when the respondent has not completed any batch", () => {
        expect(
            shouldShowExperimentThanksScreen(0, { hasCompleted: false, latestQueueIndex: null })
        ).toBe(false)
    })

    it("shows thanks when revisiting the default link after queue 0", () => {
        expect(
            shouldShowExperimentThanksScreen(0, { hasCompleted: true, latestQueueIndex: 0 })
        ).toBe(true)
    })

    it("allows continuing when queue index is ahead of the latest completion", () => {
        expect(
            shouldShowExperimentThanksScreen(1, { hasCompleted: true, latestQueueIndex: 0 })
        ).toBe(false)
    })

    it("shows thanks when revisiting an already completed batch URL", () => {
        expect(
            shouldShowExperimentThanksScreen(1, { hasCompleted: true, latestQueueIndex: 2 })
        ).toBe(true)
    })
})
