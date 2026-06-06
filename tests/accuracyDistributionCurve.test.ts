import { describe, expect, it } from "vitest"
import { buildAccuracyHistogram } from "@/lib/survey/accuracyDistribution"
import {
    buildCumulativeCurvePoints,
    cumulativeAreaPath,
    interpolateCumulativeAt,
    linearCurvePath,
} from "@/lib/survey/accuracyDistributionCurve"

describe("accuracyDistributionCurve", () => {
    it("builds a cumulative curve from 0 to 1", () => {
        const bins = buildAccuracyHistogram([0.1, 0.5, 0.5, 0.9])
        const points = buildCumulativeCurvePoints(bins)

        expect(points[0]).toEqual({ x: 0, y: 0 })
        expect(points[points.length - 1]).toEqual({ x: 1, y: 1 })
    })

    it("interpolates cumulative proportion along the curve", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 0.5, y: 0.4 },
            { x: 1, y: 1 },
        ]

        expect(interpolateCumulativeAt(points, 0.5)).toBe(0.4)
        expect(interpolateCumulativeAt(points, 0.25)).toBeCloseTo(0.2)
    })

    it("returns empty paths when there are no points", () => {
        expect(linearCurvePath([])).toBe("")
        expect(cumulativeAreaPath([])).toBe("")
    })

    it("produces svg path strings for a non-empty cumulative curve", () => {
        const bins = buildAccuracyHistogram([0.2, 0.4, 0.6, 0.8, 1.0])
        const points = buildCumulativeCurvePoints(bins)

        expect(linearCurvePath(points)).toMatch(/^M .* L /)
        expect(cumulativeAreaPath(points)).toMatch(/ Z$/)
    })
})
