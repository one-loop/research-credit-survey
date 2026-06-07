import type { AccuracyHistogramBin } from "@/lib/survey/accuracyDistribution"

export type CurvePoint = {
    x: number
    y: number
}

/** Empirical CDF from histogram bins: share of scores at or below each bin edge. */
export function buildCumulativeCurvePoints(bins: AccuracyHistogramBin[]): CurvePoint[] {
    const total = bins.reduce((sum, bin) => sum + bin.count, 0)
    if (total === 0) {
        return [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
        ]
    }

    const points: CurvePoint[] = [{ x: 0, y: 0 }]
    let cumulative = 0

    for (const bin of bins) {
        cumulative += bin.count
        points.push({ x: bin.binEnd, y: cumulative / total })
    }

    return points
}

/** Piecewise-linear cumulative proportion at accuracy x (0–1). */
export function interpolateCumulativeAt(points: CurvePoint[], x: number): number {
    if (!points.length) return 0
    const clamped = Math.min(1, Math.max(0, x))

    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i]!
        const end = points[i + 1]!
        if (clamped >= start.x && clamped <= end.x) {
            if (end.x === start.x) return start.y
            const t = (clamped - start.x) / (end.x - start.x)
            return start.y + t * (end.y - start.y)
        }
    }

    return points[points.length - 1]!.y
}

/** Straight-line SVG path (preserves monotonic CDF shape). */
export function linearCurvePath(points: CurvePoint[]): string {
    if (points.length === 0) return ""
    return points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
        .join(" ")
}

/** Closed path: CDF line on top, baseline at `baselineY` (0 in normalized coords, plot bottom in SVG). */
export function cumulativeAreaPath(points: CurvePoint[], baselineY = 0): string {
    if (points.length < 2) return ""

    const line = linearCurvePath(points)
    const last = points[points.length - 1]!
    const first = points[0]!
    return `${line} L ${last.x},${baselineY} L ${first.x},${baselineY} Z`
}

/** Point on the empirical CDF at the respondent's accuracy (same curve the chart draws). */
export function markerOnCumulativeCurve(
    points: CurvePoint[],
    comparisonScore: number
): CurvePoint | null {
    if (!Number.isFinite(comparisonScore)) return null
    const x = Math.min(1, Math.max(0, comparisonScore))
    return { x, y: interpolateCumulativeAt(points, x) }
}
