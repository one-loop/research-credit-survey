import { unstable_cache } from "next/cache"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import {
    buildAccuracyDistributionStats,
    hasEnoughResponsesForGlobalAnalytics,
    type AccuracyDistributionStats,
} from "@/lib/survey/accuracyDistribution"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"
import {
    buildInstitutionLeaderboard,
    institutionKeyFromDemographics,
    institutionPercentileForScore,
    type InstitutionLeaderboardResult,
    type ResponseForLeaderboard,
} from "@/lib/survey/institutionLeaderboard"

export type ExperimentAnalyticsRow = ResponseForLeaderboard

export function experimentAnalyticsCacheTag(experimentType: ExperimentType): string {
    return `experiment-analytics-${experimentType}`
}

export function enrichRowsWithAuthorDemographics(
    rows: Array<{
        average_accuracy: number
        respondent_demographics?: Record<string, unknown> | null
        author_id?: string | null
    }>
): ExperimentAnalyticsRow[] {
    const demographicsByAuthor = new Map<string, Record<string, unknown>>()
    for (const row of rows) {
        const authorId =
            typeof row.author_id === "string" && row.author_id.trim().length > 0
                ? row.author_id.trim()
                : null
        const demo = row.respondent_demographics ?? null
        if (authorId && demo && institutionKeyFromDemographics(demo)) {
            demographicsByAuthor.set(authorId, demo)
        }
    }

    return rows
        .map((row) => {
            const averageAccuracy = row.average_accuracy
            if (typeof averageAccuracy !== "number" || !Number.isFinite(averageAccuracy)) {
                return null
            }
            const authorId =
                typeof row.author_id === "string" && row.author_id.trim().length > 0
                    ? row.author_id.trim()
                    : null
            const demographics =
                row.respondent_demographics ??
                (authorId ? demographicsByAuthor.get(authorId) : undefined) ??
                null
            return {
                averageAccuracy,
                demographics,
            }
        })
        .filter((r): r is ExperimentAnalyticsRow => r !== null)
}

export async function fetchExperimentAnalyticsRows(
    experimentType: ExperimentType
): Promise<ExperimentAnalyticsRow[]> {
    if (!isSupabaseConfigured()) return []

    const supabase = getSupabase()
    const { data, error } = await supabase
        .from("experiment_responses")
        .select("average_accuracy, respondent_demographics, author_id")
        .eq("experiment_type", experimentType)
        .not("average_accuracy", "is", null)

    if (error || !data?.length) return []

    return enrichRowsWithAuthorDemographics(
        data as Array<{
            average_accuracy: number
            respondent_demographics?: Record<string, unknown> | null
            author_id?: string | null
        }>
    )
}

/** Shared pool for histogram + leaderboard (cached ~30s per experiment). */
export function getCachedExperimentAnalyticsRows(
    experimentType: ExperimentType
): Promise<ExperimentAnalyticsRow[]> {
    return unstable_cache(
        () => fetchExperimentAnalyticsRows(experimentType),
        ["experiment-analytics-rows", experimentType],
        { revalidate: 30, tags: [experimentAnalyticsCacheTag(experimentType)] }
    )()
}

export async function getRespondentInstitutionKeyForExperiment(
    authorId: string | undefined,
    experimentType: ExperimentType
): Promise<string | null> {
    if (!authorId || !isSupabaseConfigured()) return null

    try {
        const supabase = getSupabase()
        const { data } = await supabase
            .from("experiment_responses")
            .select("respondent_demographics")
            .eq("author_id", authorId)
            .eq("experiment_type", experimentType)
            .not("respondent_demographics", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)

        const demo = (data?.[0] as { respondent_demographics?: Record<string, unknown> })
            ?.respondent_demographics
        return institutionKeyFromDemographics(demo ?? null)
    } catch {
        return null
    }
}

export async function getExperimentThankYouAnalytics(
    experimentType: ExperimentType,
    comparisonScore: number | null,
    respondentInstitutionKey: string | null,
    opts?: { fresh?: boolean }
): Promise<{
    distribution: AccuracyDistributionStats
    leaderboard: InstitutionLeaderboardResult
    institutionPercentile: number | null
}> {
    const rows = opts?.fresh
        ? await fetchExperimentAnalyticsRows(experimentType)
        : await getCachedExperimentAnalyticsRows(experimentType)
    const scores = rows.map((r) => r.averageAccuracy)
    const showGlobalAnalytics = hasEnoughResponsesForGlobalAnalytics(scores.length)

    let institutionPercentile: number | null = null
    if (
        showGlobalAnalytics &&
        respondentInstitutionKey &&
        typeof comparisonScore === "number" &&
        Number.isFinite(comparisonScore)
    ) {
        institutionPercentile = institutionPercentileForScore(
            rows,
            respondentInstitutionKey,
            comparisonScore
        )
    }

    return {
        distribution: buildAccuracyDistributionStats(scores, comparisonScore),
        leaderboard: showGlobalAnalytics
            ? buildInstitutionLeaderboard(rows, respondentInstitutionKey)
            : { top10: [], respondent: null, respondentInstitutionKey: null },
        institutionPercentile,
    }
}
