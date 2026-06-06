import { describe, expect, it } from "vitest"
import {
    DEFAULT_MOCK_DISTRIBUTION_SAMPLES,
    mockAccuracySamples,
    mockDistributionBins,
    mulberry32,
    parseMockDistributionSampleCount,
} from "@/lib/survey/mockDistributionSamples"

describe("mockDistributionSamples", () => {
    it("generates the requested number of scores in range", () => {
        const scores = mockAccuracySamples(200)
        expect(scores).toHaveLength(200)
        for (const score of scores) {
            expect(score).toBeGreaterThanOrEqual(0.15)
            expect(score).toBeLessThanOrEqual(0.99)
        }
    })

    it("is reproducible for a fixed seed", () => {
        expect(mockAccuracySamples(50, 99)).toEqual(mockAccuracySamples(50, 99))
    })

    it("builds histogram bins from mock scores", () => {
        const bins = mockDistributionBins(200)
        expect(bins).toHaveLength(20)
        expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(200)
    })

    it("parses mockDistribution query values in development", () => {
        const prev = process.env.NODE_ENV
        process.env.NODE_ENV = "development"

        expect(parseMockDistributionSampleCount(null)).toBe(0)
        expect(parseMockDistributionSampleCount("")).toBe(DEFAULT_MOCK_DISTRIBUTION_SAMPLES)
        expect(parseMockDistributionSampleCount("true")).toBe(DEFAULT_MOCK_DISTRIBUTION_SAMPLES)
        expect(parseMockDistributionSampleCount("150")).toBe(150)

        process.env.NODE_ENV = prev
    })

    it("mulberry32 returns values in [0, 1)", () => {
        const rand = mulberry32(1)
        for (let i = 0; i < 20; i++) {
            const value = rand()
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThan(1)
        }
    })
})
