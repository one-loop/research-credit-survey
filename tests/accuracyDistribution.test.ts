import { describe, expect, it } from "vitest"
import {
    ACCURACY_DISTRIBUTION_MIN_RESPONSES,
    accuracyPercentileRank,
    buildAccuracyDistributionStats,
    buildAccuracyHistogram,
} from "@/lib/survey/accuracyDistribution"

describe("accuracyDistribution", () => {
    it("does not show distribution when there are no responses", () => {
        const stats = buildAccuracyDistributionStats([], 0.85)
        expect(stats.showDistribution).toBe(false)
        expect(stats.responseCount).toBe(0)
    })

    it("shows distribution after one or more responses", () => {
        const scores = [0.75]
        const stats = buildAccuracyDistributionStats(scores, 0.75)
        expect(stats.showDistribution).toBe(true)
        expect(stats.bins).toHaveLength(20)
        expect(stats.percentile).toBe(50)
    })

    it("computes percentile rank", () => {
        const population = [0.2, 0.4, 0.6, 0.8, 1.0]
        expect(accuracyPercentileRank(0.2, population)).toBe(10)
        expect(accuracyPercentileRank(0.8, population)).toBe(70)
        expect(accuracyPercentileRank(1.0, population)).toBe(90)
    })

    it("builds histogram bins covering 0–1", () => {
        const bins = buildAccuracyHistogram([0, 0.05, 0.95, 1])
        expect(bins[0]!.count).toBeGreaterThanOrEqual(1)
        expect(bins[19]!.count).toBeGreaterThanOrEqual(1)
        expect(bins.reduce((s, b) => s + b.count, 0)).toBe(4)
    })

    it("exports threshold constant", () => {
        expect(ACCURACY_DISTRIBUTION_MIN_RESPONSES).toBe(1)
    })
})
