import { buildAccuracyHistogram } from "@/lib/survey/accuracyDistribution"

export const DEFAULT_MOCK_DISTRIBUTION_SAMPLES = 200

/** Small seeded PRNG for reproducible dev previews. */
export function mulberry32(seed: number): () => number {
    let state = seed | 0
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * Synthetic block-level accuracies for chart previews.
 * Roughly normal, centered ~74% with most mass between ~50% and ~95%.
 */
export function mockAccuracySamples(count: number, seed = 20260331): number[] {
    const rand = mulberry32(seed)
    const samples: number[] = []

    for (let i = 0; i < count; i++) {
        let sum = 0
        for (let j = 0; j < 10; j++) sum += rand()
        const z = (sum - 5) / Math.sqrt(10 / 12)
        const accuracy = 0.74 + z * 0.12
        samples.push(Math.min(0.99, Math.max(0.15, accuracy)))
    }

    return samples
}

export function mockDistributionBins(sampleCount: number) {
    return buildAccuracyHistogram(mockAccuracySamples(sampleCount))
}

/**
 * Parse `?mockDistribution=200` (dev only by default).
 * - `?mockDistribution` or `?mockDistribution=true` → 200 samples
 * - `?mockDistribution=150` → 150 samples
 */
export function parseMockDistributionSampleCount(
    raw: string | null,
    options?: { allowInProduction?: boolean }
): number {
    if (!options?.allowInProduction && process.env.NODE_ENV !== "development") {
        return 0
    }
    if (raw === null) return 0
    if (raw === "" || raw === "1" || raw === "true") return DEFAULT_MOCK_DISTRIBUTION_SAMPLES

    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return 0
    return Math.min(Math.floor(parsed), 10_000)
}
