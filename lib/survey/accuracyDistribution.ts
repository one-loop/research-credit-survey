/** Minimum completed queue submissions before showing the accuracy distribution. */
export const ACCURACY_DISTRIBUTION_MIN_RESPONSES = 1

export type AccuracyHistogramBin = {
    binStart: number
    binEnd: number
    count: number
}

export type AccuracyDistributionStats = {
    responseCount: number
    showDistribution: boolean
    bins: AccuracyHistogramBin[]
    /** 0–100: share of recorded scores at or below the respondent's comparison score. */
    percentile: number | null
    /** Score used for percentile marker (0–1). */
    comparisonScore: number | null
    /** All response-level accuracies in the pool (for debugging/tests; omit from API if large). */
    scores?: number[]
}

const BIN_COUNT = 10

export function buildAccuracyHistogram(scores: number[], binCount = BIN_COUNT): AccuracyHistogramBin[] {
    if (scores.length === 0) {
        return Array.from({ length: binCount }, (_, i) => ({
            binStart: i / binCount,
            binEnd: (i + 1) / binCount,
            count: 0,
        }))
    }

    const bins: AccuracyHistogramBin[] = []
    for (let i = 0; i < binCount; i++) {
        const binStart = i / binCount
        const binEnd = (i + 1) / binCount
        const count = scores.filter((s) => {
            if (i === binCount - 1) return s >= binStart && s <= binEnd
            return s >= binStart && s < binEnd
        }).length
        bins.push({ binStart, binEnd, count })
    }
    return bins
}

/**
 * Percentile rank (0–100): percentage of the population at or below `value`.
 * Uses linear interpolation among tied values.
 */
export function accuracyPercentileRank(value: number, population: number[]): number | null {
    if (!population.length || !Number.isFinite(value)) return null
    const sorted = [...population].sort((a, b) => a - b)
    const below = sorted.filter((v) => v < value).length
    const equal = sorted.filter((v) => v === value).length
    return ((below + 0.5 * equal) / sorted.length) * 100
}

export function buildAccuracyDistributionStats(
    allScores: number[],
    comparisonScore: number | null,
    minResponses = ACCURACY_DISTRIBUTION_MIN_RESPONSES
): AccuracyDistributionStats {
    const responseCount = allScores.length
    const showDistribution = responseCount >= minResponses
    const percentile =
        showDistribution && typeof comparisonScore === "number" && Number.isFinite(comparisonScore)
            ? accuracyPercentileRank(comparisonScore, allScores)
            : null

    return {
        responseCount,
        showDistribution,
        bins: buildAccuracyHistogram(allScores),
        percentile,
        comparisonScore,
    }
}
