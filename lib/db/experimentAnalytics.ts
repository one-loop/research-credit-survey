import { unstable_cache } from "next/cache"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import {
    buildAccuracyDistributionStats,
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

async function fetchExperimentAnalyticsRows(
    experimentType: ExperimentType
): Promise<ExperimentAnalyticsRow[]> {
    if (!isSupabaseConfigured()) return []

    const supabase = getSupabase()
    const { data, error } = await supabase
        .from("experiment_responses")
        .select("average_accuracy, respondent_demographics")
        .eq("experiment_type", experimentType)
        .not("average_accuracy", "is", null)

    if (error || !data?.length) return []

    return data
        .map((row) => {
            const r = row as {
                average_accuracy?: number | null
                respondent_demographics?: Record<string, unknown> | null
            }
            const averageAccuracy = r.average_accuracy
            if (typeof averageAccuracy !== "number" || !Number.isFinite(averageAccuracy)) {
                return null
            }
            return {
                averageAccuracy,
                demographics: r.respondent_demographics ?? null,
            }
        })
        .filter((r): r is ExperimentAnalyticsRow => r !== null)
}

/** Shared pool for histogram + leaderboard (cached ~30s per experiment). */
export function getCachedExperimentAnalyticsRows(
    experimentType: ExperimentType
): Promise<ExperimentAnalyticsRow[]> {
    return unstable_cache(
        () => fetchExperimentAnalyticsRows(experimentType),
        ["experiment-analytics-rows", experimentType],
        { revalidate: 30, tags: [`experiment-analytics-${experimentType}`] }
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
    respondentInstitutionKey: string | null
): Promise<{
    distribution: AccuracyDistributionStats
    leaderboard: InstitutionLeaderboardResult
    institutionPercentile: number | null
}> {
    const rows = await getCachedExperimentAnalyticsRows(experimentType)
    const scores = rows.map((r) => r.averageAccuracy)

    let institutionPercentile: number | null = null
    if (
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
        leaderboard: buildInstitutionLeaderboard(rows, respondentInstitutionKey),
        institutionPercentile,
    }
}
