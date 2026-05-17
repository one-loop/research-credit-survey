import { describe, expect, it } from "vitest"
import {
    averageRankingAccuracy,
    buildEqualContributionBlocks,
    collapseRankingToBlockSequence,
    kendallTau,
    rankingAccuracyForWork,
    tauToAccuracy,
} from "@/lib/survey/rankingAccuracy"

function authors(
    specs: Array<{ id: string; equal_contrib?: boolean }>
): Array<{ id: string; equal_contrib?: boolean }> {
    return specs
}

describe("rankingAccuracy", () => {
    it("scores ABCD and ACBD as 100% when B and C are equal contributors", () => {
        const canonical = authors([
            { id: "A" },
            { id: "B", equal_contrib: true },
            { id: "C", equal_contrib: true },
            { id: "D" },
        ])
        expect(rankingAccuracyForWork(canonical, ["A", "B", "C", "D"])).toBe(1)
        expect(rankingAccuracyForWork(canonical, ["A", "C", "B", "D"])).toBe(1)
    })

    it("scores a fully reversed block order below perfect", () => {
        const canonical = authors([
            { id: "A" },
            { id: "B", equal_contrib: true },
            { id: "C", equal_contrib: true },
            { id: "D" },
        ])
        const accuracy = rankingAccuracyForWork(canonical, ["D", "C", "B", "A"])
        expect(accuracy).not.toBeNull()
        expect(accuracy!).toBeLessThan(1)
        expect(accuracy!).toBeGreaterThanOrEqual(0)
    })

    it("maps tau -1..1 to accuracy 0..1", () => {
        expect(tauToAccuracy(-1)).toBe(0)
        expect(tauToAccuracy(0)).toBe(0.5)
        expect(tauToAccuracy(1)).toBe(1)
    })

    it("builds consecutive equal-contribution groups", () => {
        const { authorToBlock, canonicalBlockSequence } = buildEqualContributionBlocks(
            authors([
                { id: "x", equal_contrib: true },
                { id: "y", equal_contrib: true },
                { id: "z" },
            ])
        )
        expect(authorToBlock.get("x")).toBe(0)
        expect(authorToBlock.get("y")).toBe(0)
        expect(authorToBlock.get("z")).toBe(1)
        expect(canonicalBlockSequence).toEqual([0, 1])
        expect(kendallTau([0, 1], [0, 1])).toBe(1)
    })

    it("requires strict order when there are no equal contributors", () => {
        const canonical = authors([{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }])
        expect(rankingAccuracyForWork(canonical, ["A", "B", "C", "D"])).toBe(1)
        expect(rankingAccuracyForWork(canonical, ["A", "C", "B", "D"])).toBeLessThan(1)
    })

    it("collapses equal-contribution swaps to the same block sequence", () => {
        const canonical = authors([
            { id: "A" },
            { id: "B", equal_contrib: true },
            { id: "C", equal_contrib: true },
            { id: "D" },
        ])
        const { authorToBlock } = buildEqualContributionBlocks(canonical)
        expect(collapseRankingToBlockSequence(["A", "B", "C", "D"], authorToBlock)).toEqual([
            0, 1, 2,
        ])
        expect(collapseRankingToBlockSequence(["A", "C", "B", "D"], authorToBlock)).toEqual([
            0, 1, 2,
        ])
    })

    it("averages per-work accuracy across five tasks for a block score", () => {
        const canonicalFour = authors([
            { id: "A" },
            { id: "B", equal_contrib: true },
            { id: "C", equal_contrib: true },
            { id: "D" },
        ])
        const canonicalStrict = authors([{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }])

        const perWork = [
            rankingAccuracyForWork(canonicalFour, ["A", "B", "C", "D"]),
            rankingAccuracyForWork(canonicalFour, ["A", "C", "B", "D"]),
            rankingAccuracyForWork(canonicalStrict, ["A", "B", "C", "D"]),
            rankingAccuracyForWork(canonicalStrict, ["A", "B", "C", "D"]),
            rankingAccuracyForWork(canonicalStrict, ["A", "C", "B", "D"]),
        ]

        const blockAverage = averageRankingAccuracy(perWork)
        expect(blockAverage).not.toBeNull()
        // Four perfect (1.0) + one imperfect swap => (4 + <1) / 5
        expect(blockAverage!).toBeGreaterThan(0.9)
        expect(blockAverage!).toBeLessThan(1)
    })
})
