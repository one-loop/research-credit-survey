import { describe, expect, it } from "vitest"
import { shouldExcludeBySeenRules, isInRespondentScope, type SeenWorkStats } from "@/lib/survey/poolEligibility"

function stats(overrides?: Partial<SeenWorkStats>): SeenWorkStats {
    return {
        seenByRespondent: false,
        uniqueRespondents: new Set<string>(),
        experimentsSeenIn: new Set<"A" | "B" | "C">(),
        ...overrides,
    }
}

describe("Eligibility Pool — journal/domain scope", () => {
    it("keeps only works from respondent's own journal and domain", () => {
        expect(
            isInRespondentScope(
                { domain: "Life Sciences", journal: "PNAS" },
                { domain: "Life Sciences", journal: "PNAS" }
            )
        ).toBe(true)
        expect(
            isInRespondentScope(
                { domain: "Social Sciences", journal: "PNAS" },
                { domain: "Life Sciences", journal: "PNAS" }
            )
        ).toBe(false)
        expect(
            isInRespondentScope(
                { domain: "Life Sciences", journal: "PLOS ONE" },
                { domain: "Life Sciences", journal: "PNAS" }
            )
        ).toBe(false)
    })
})

describe("Eligibility Pool — seen-work exclusions", () => {
    it("excludes a work the respondent has already seen", () => {
        const excluded = shouldExcludeBySeenRules(
            { work_id: "w1" },
            stats({ seenByRespondent: true }),
            { ownWorkId: "own1", experimentType: "A" }
        )
        expect(excluded).toBe(true)
    })

    it("excludes a seen work by 3 respondents", () => {
        const excluded = shouldExcludeBySeenRules(
            { work_id: "w2" },
            stats({ uniqueRespondents: new Set(["r1", "r2", "r3"]) }),
            { ownWorkId: "own1", experimentType: "A" }
        )
        expect(excluded).toBe(true)
    })

    it("excludes a seen work by 2 respondents when it is not the respondent's own paper", () => {
        const excluded = shouldExcludeBySeenRules(
            { work_id: "other" },
            stats({ uniqueRespondents: new Set(["r1", "r2"]) }),
            { ownWorkId: "own1", experimentType: "A" }
        )
        expect(excluded).toBe(true)
    })

    it("does not exclude own paper solely for being seen by 2 respondents", () => {
        const excluded = shouldExcludeBySeenRules(
            { work_id: "own1" },
            stats({ uniqueRespondents: new Set(["r1", "r2"]) }),
            { ownWorkId: "own1", experimentType: "A" }
        )
        expect(excluded).toBe(false)
    })

    it("excludes a work seen in a different experiment than respondent's assignment", () => {
        const excluded = shouldExcludeBySeenRules(
            { work_id: "w3" },
            stats({ experimentsSeenIn: new Set(["B"]) }),
            { ownWorkId: "own1", experimentType: "A" }
        )
        expect(excluded).toBe(true)
    })

    it("does not exclude when seen only in same experiment and under respondent-count caps", () => {
        const excluded = shouldExcludeBySeenRules(
            { work_id: "w4" },
            stats({
                uniqueRespondents: new Set(["r1"]),
                experimentsSeenIn: new Set(["A"]),
            }),
            { ownWorkId: "own1", experimentType: "A" }
        )
        expect(excluded).toBe(false)
    })

    it("does not exclude unseen work", () => {
        const excluded = shouldExcludeBySeenRules(
            { work_id: "w5" },
            undefined,
            { ownWorkId: "own1", experimentType: "C" }
        )
        expect(excluded).toBe(false)
    })
})

