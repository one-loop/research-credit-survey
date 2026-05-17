export type ExperimentType = "A" | "B" | "C"

/** Uniform random experiment when no seen-work lock applies. */
export function pickRandomExperiment(opts: {
    allowB: boolean
    /** Returns a number in [0, 1); inject for deterministic tests. Defaults to Math.random. */
    random?: () => number
}): ExperimentType {
    const rand = opts.random ?? Math.random
    const experiments: ExperimentType[] = opts.allowB ? ["A", "B", "C"] : ["A", "C"]
    const idx = Math.floor(rand() * experiments.length)
    return experiments[idx] ?? "A"
}

/**
 * Core assignment rules (matches GET /api/survey/experiment-assignment Supabase branch).
 * Caller supplies `seenExperiment` after resolving DB state (most recent response overlapping respondent works).
 */
export function resolveExperimentAssignment(opts: {
    seenExperiment: ExperimentType | null
    allowB: boolean
    random?: () => number
}): { experiment: ExperimentType; lockedBySeenWork: boolean } {
    const { seenExperiment, allowB } = opts

    if (seenExperiment && (seenExperiment !== "B" || allowB)) {
        return { experiment: seenExperiment, lockedBySeenWork: true }
    }

    return {
        experiment: pickRandomExperiment({ allowB, random: opts.random }),
        lockedBySeenWork: false,
    }
}

/** Normalize DB row experiment_type to A|B|C or null. */
export function parseExperimentType(value: unknown): ExperimentType | null {
    return value === "A" || value === "B" || value === "C" ? value : null
}

/**
 * Given responses overlapping the respondent's works, newest first (as returned by Supabase order).
 * Returns the experiment type of the most recent qualifying row.
 */
export function experimentFromOrderedResponses(
    responses: ReadonlyArray<{ experiment_type: unknown; created_at: string }>
): ExperimentType | null {
    for (const row of responses) {
        const exp = parseExperimentType(row.experiment_type)
        if (exp) return exp
    }
    return null
}
