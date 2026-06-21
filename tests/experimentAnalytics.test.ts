import { describe, expect, it } from "vitest"
import { enrichRowsWithAuthorDemographics } from "@/lib/db/experimentAnalytics"
import { buildInstitutionLeaderboard } from "@/lib/survey/institutionLeaderboard"

describe("institution analytics after multiple submissions", () => {
    it("updates institution average when the same institution submits again", () => {
        const demographics = {
            institution_id: "1",
            institution: "Alpha University",
        }
        const afterFirst = buildInstitutionLeaderboard(
            [{ averageAccuracy: 0.6, demographics }],
            "id:1"
        )
        expect(afterFirst.top10[0]!.averageAccuracy).toBeCloseTo(0.6)
        expect(afterFirst.top10[0]!.responseCount).toBe(1)

        const afterSecond = buildInstitutionLeaderboard(
            [
                { averageAccuracy: 0.6, demographics },
                { averageAccuracy: 0.8, demographics },
            ],
            "id:1"
        )
        expect(afterSecond.top10[0]!.averageAccuracy).toBeCloseTo(0.7)
        expect(afterSecond.top10[0]!.responseCount).toBe(2)
    })

    it("inherits demographics from an earlier submission by the same author", () => {
        const demographics = {
            institution_id: "42",
            institution: "Example University",
        }
        const rows = enrichRowsWithAuthorDemographics([
            {
                average_accuracy: 0.5,
                respondent_demographics: demographics,
                author_id: "author-1",
            },
            {
                average_accuracy: 0.9,
                respondent_demographics: null,
                author_id: "author-1",
            },
        ])

        const leaderboard = buildInstitutionLeaderboard(rows, "id:42")
        expect(leaderboard.top10[0]!.averageAccuracy).toBeCloseTo(0.7)
        expect(leaderboard.top10[0]!.responseCount).toBe(2)
    })
})
