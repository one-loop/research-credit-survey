import { describe, expect, it } from "vitest"
import {
    authorCountRangeForBin,
    authorCountToBin,
    batchCoversAllAuthorBins,
    fallbackBinsFor,
    selectWorksOnePerAuthorBin,
    shuffleAuthorCountBins,
    WORKS_PER_AUTHOR_BIN_BATCH,
    type AuthorBinnedWork,
} from "@/lib/survey/authorCountBins"

describe("authorCountToBin", () => {
    it("maps counts to the five survey bins", () => {
        expect(authorCountToBin(2)).toBe(2)
        expect(authorCountToBin(5)).toBe(5)
        expect(authorCountToBin(7)).toBe("6-10")
        expect(authorCountToBin(10)).toBe("6-10")
        expect(authorCountToBin(1)).toBeNull()
        expect(authorCountToBin(11)).toBeNull()
    })
})

describe("authorCountRangeForBin", () => {
    it("returns single-count ranges for fixed bins", () => {
        expect(authorCountRangeForBin(3)).toEqual({ min: 3, max: 3 })
        expect(authorCountRangeForBin("6-10")).toEqual({ min: 6, max: 10 })
    })
})

describe("selectWorksOnePerAuthorBin", () => {
    const candidates = [
        { work_id: "w2", authorCount: 2 },
        { work_id: "w3", authorCount: 3 },
        { work_id: "w4", authorCount: 4 },
        { work_id: "w5", authorCount: 5 },
        { work_id: "w8", authorCount: 8 },
        { work_id: "w3b", authorCount: 3 },
    ]

    it("returns one work per bin when available", () => {
        const selected = selectWorksOnePerAuthorBin({
            candidates,
            random: () => 0,
        })
        expect(selected).toHaveLength(WORKS_PER_AUTHOR_BIN_BATCH)
        expect(batchCoversAllAuthorBins(selected)).toBe(true)
    })

    it("randomizes bin order across batches", () => {
        const orders = new Set<string>()
        for (let i = 0; i < 20; i++) {
            const selected = selectWorksOnePerAuthorBin({
                candidates,
                random: () => (i * 0.17) % 1,
            })
            orders.add(selected.map((w) => w.work_id).join(","))
        }
        expect(orders.size).toBeGreaterThan(1)
    })

    it("uses own work for its author-count bin", () => {
        const ownWork: AuthorBinnedWork = { work_id: "own4", authorCount: 4, isOwnWork: true }
        const selected = selectWorksOnePerAuthorBin({
            candidates,
            ownWork,
            random: () => 0,
        })
        expect(selected.some((w) => w.work_id === "own4")).toBe(true)
        expect(selected.filter((w) => authorCountToBin(w.authorCount) === 4)).toHaveLength(1)
    })

    it("falls back to the next bin when a bin is empty", () => {
        const sparse = [
            { work_id: "only3", authorCount: 3 },
            { work_id: "only4", authorCount: 4 },
            { work_id: "only5", authorCount: 5 },
            { work_id: "only8", authorCount: 8 },
        ]
        const selected = selectWorksOnePerAuthorBin({
            candidates: sparse,
            random: () => 0,
        })
        expect(selected.length).toBe(sparse.length)
        expect(selected.some((w) => w.work_id === "only3")).toBe(true)
    })

    it("respects reserved work ids", () => {
        const selected = selectWorksOnePerAuthorBin({
            candidates,
            reservedWorkIds: new Set(["w3", "w4"]),
            random: () => 0,
        })
        expect(selected.some((w) => w.work_id === "w3")).toBe(false)
        expect(selected.some((w) => w.work_id === "w4")).toBe(false)
        expect(selected.some((w) => w.work_id === "w3b")).toBe(true)
    })

    it("does not fill every slot from the same bin when others are available", () => {
        const manyTwos = Array.from({ length: 8 }, (_, i) => ({
            work_id: `two_${i}`,
            authorCount: 2,
        }))
        const selected = selectWorksOnePerAuthorBin({
            candidates: [
                ...manyTwos,
                { work_id: "w3", authorCount: 3 },
                { work_id: "w4", authorCount: 4 },
                { work_id: "w5", authorCount: 5 },
                { work_id: "w8", authorCount: 8 },
            ],
            random: () => 0.5,
        })
        expect(selected).toHaveLength(WORKS_PER_AUTHOR_BIN_BATCH)
        expect(batchCoversAllAuthorBins(selected)).toBe(true)
        expect(
            selected.filter((work) => authorCountToBin(work.authorCount) === 2)
        ).toHaveLength(1)
    })

    it("still fills 5 slots when only one bin has eligible papers", () => {
        const manyTwos = Array.from({ length: 10 }, (_, i) => ({
            work_id: `two_${i}`,
            authorCount: 2,
        }))
        const selected = selectWorksOnePerAuthorBin({
            candidates: manyTwos,
            random: () => 0,
        })
        expect(selected).toHaveLength(WORKS_PER_AUTHOR_BIN_BATCH)
        expect(new Set(selected.map((work) => work.work_id)).size).toBe(
            WORKS_PER_AUTHOR_BIN_BATCH
        )
    })
})

describe("fallbackBinsFor", () => {
    it("starts with the primary bin and walks forward", () => {
        expect(fallbackBinsFor(4)).toEqual([4, 5, "6-10", 2, 3])
    })
})

describe("shuffleAuthorCountBins", () => {
    it("returns a permutation of all bins", () => {
        const shuffled = shuffleAuthorCountBins(() => 0.99)
        expect(shuffled.sort()).toEqual([2, 3, 4, 5, "6-10"].sort())
    })
})
