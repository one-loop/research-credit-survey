import { NextRequest, NextResponse } from "next/server"
import {
    getAccuracyDistributionForExperiment,
    getInstitutionLeaderboardForExperiment,
    getRespondentAccuracySummary,
} from "@/lib/db/papers"
import { getParticipantAuthorId } from "@/lib/survey/participant"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"

function parseExperimentType(raw: string | null): ExperimentType {
    if (raw === "B" || raw === "C") return raw
    return "A"
}

export async function GET(request: NextRequest) {
    const authorId = getParticipantAuthorId(request)
    const experimentType = parseExperimentType(request.nextUrl.searchParams.get("experimentType"))
    const queueRaw = Number(request.nextUrl.searchParams.get("queueIndex") ?? "0")
    const queueIndex = Number.isFinite(queueRaw) && queueRaw >= 0 ? Math.floor(queueRaw) : 0

    const summary = await getRespondentAccuracySummary(authorId, experimentType, queueIndex)

    const comparisonScore =
        summary.respondentAverageAccuracy ?? summary.queueAccuracy ?? null
    const distribution = await getAccuracyDistributionForExperiment(
        experimentType,
        comparisonScore
    )
    const leaderboard = await getInstitutionLeaderboardForExperiment(authorId, experimentType)

    return NextResponse.json({
        queueIndex,
        experimentType,
        queueAccuracy: summary.queueAccuracy,
        respondentAverageAccuracy: summary.respondentAverageAccuracy,
        queuesCompleted: summary.queuesCompleted,
        distribution: {
            show: distribution.showDistribution,
            responseCount: distribution.responseCount,
            bins: distribution.bins,
            percentile: distribution.percentile,
            comparisonScore: distribution.comparisonScore,
        },
        leaderboard: {
            top10: leaderboard.top10,
            respondent: leaderboard.respondent,
            highlightInstitutionKey: leaderboard.respondentInstitutionKey,
        },
        /** @deprecated Use queueAccuracy */
        averageAccuracy: summary.queueAccuracy,
    })
}
