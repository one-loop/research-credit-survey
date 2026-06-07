import { describe, expect, it } from "vitest"
import { paperHasCompleteContributions } from "@/lib/survey/paperContributions"

describe("paperHasCompleteContributions", () => {
    it("returns false for missing or empty authors", () => {
        expect(paperHasCompleteContributions(undefined)).toBe(false)
        expect(paperHasCompleteContributions(null)).toBe(false)
        expect(paperHasCompleteContributions([])).toBe(false)
    })

    it("returns false when any author has empty contributions", () => {
        expect(
            paperHasCompleteContributions([
                { contributions: ["Conceptualization"] },
                { contributions: [] },
            ])
        ).toBe(false)
        expect(
            paperHasCompleteContributions([
                { contributions: ["Conceptualization"] },
                {},
            ])
        ).toBe(false)
    })

    it("returns true when every author has at least one contribution", () => {
        expect(
            paperHasCompleteContributions([
                { contributions: ["Conceptualization"] },
                { contributions: ["Investigation", "Formal analysis"] },
            ])
        ).toBe(true)
    })
})
