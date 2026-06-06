import { describe, expect, it } from "vitest"
import {
    buildInstitutionLeaderboard,
    institutionKeyFromDemographics,
    institutionPercentileForScore,
} from "@/lib/survey/institutionLeaderboard"

describe("institutionLeaderboard", () => {
    it("groups by institution_id and averages scores", () => {
        const result = buildInstitutionLeaderboard(
            [
                {
                    averageAccuracy: 0.8,
                    demographics: { institution_id: "1", institution: "Alpha University" },
                },
                {
                    averageAccuracy: 1.0,
                    demographics: { institution_id: "1", institution: "Alpha University" },
                },
                {
                    averageAccuracy: 0.6,
                    demographics: { institution_id: "2", institution: "Beta College" },
                },
            ],
            "id:2"
        )

        expect(result.top10[0]!.institutionName).toBe("Alpha University")
        expect(result.top10[0]!.averageAccuracy).toBeCloseTo(0.9)
        expect(result.top10[1]!.institutionName).toBe("Beta College")
        expect(result.top10[1]!.averageAccuracy).toBeCloseTo(0.6)
        expect(result.respondent).toBeNull()
        expect(result.respondentInstitutionKey).toBe("id:2")
    })

    it("shows respondent at bottom when outside top 10", () => {
        const responses = Array.from({ length: 11 }, (_, i) => ({
            averageAccuracy: 1 - i * 0.05,
            demographics: {
                institution_id: String(i + 1),
                institution: `Institution ${i + 1}`,
            },
        }))
        const result = buildInstitutionLeaderboard(responses, "id:11")
        expect(result.top10).toHaveLength(10)
        expect(result.respondent?.institutionKey).toBe("id:11")
        expect(result.respondent?.rank).toBe(11)
    })

    it("omits bottom row when respondent is in top 10", () => {
        const result = buildInstitutionLeaderboard(
            [
                {
                    averageAccuracy: 0.9,
                    demographics: { institution: "Only U" },
                },
            ],
            "name:only u"
        )
        expect(result.top10).toHaveLength(1)
        expect(result.respondent).toBeNull()
    })

    it("derives institution key from demographics", () => {
        expect(
            institutionKeyFromDemographics({
                institution_id: "42",
                institution: "NYU",
            })
        ).toBe("id:42")
        expect(institutionKeyFromDemographics({ institution: "NYU" })).toBe("name:nyu")
    })

    it("computes percentile within institution", () => {
        const responses = [
            {
                averageAccuracy: 0.4,
                demographics: { institution_id: "1", institution: "Alpha University" },
            },
            {
                averageAccuracy: 0.8,
                demographics: { institution_id: "1", institution: "Alpha University" },
            },
            {
                averageAccuracy: 0.9,
                demographics: { institution_id: "2", institution: "Beta College" },
            },
        ]

        expect(
            institutionPercentileForScore(responses, "id:1", 0.8)
        ).toBe(75)
        expect(institutionPercentileForScore(responses, "id:2", 0.9)).toBe(50)
        expect(institutionPercentileForScore(responses, null, 0.8)).toBeNull()
    })
})
