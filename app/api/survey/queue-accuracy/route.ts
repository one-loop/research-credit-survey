import { NextRequest, NextResponse } from "next/server"
import {
    getExperimentThankYouAnalytics,
    getRespondentInstitutionKeyForExperiment,
} from "@/lib/db/experimentAnalytics"
import { getRespondentAccuracySummary } from "@/lib/db/papers"
import { getParticipantAuthorId } from "@/lib/survey/participant"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"

function parseExperimentType(raw: string | null): ExperimentType {
    if (raw === "B" || raw === "C") return raw
    return "A"
}

type Scope = "all" | "summary" | "analytics"

function parseScope(raw: string | null): Scope {
    if (raw === "summary" || raw === "analytics") return raw
    return "all"
}

function summaryPayload(
    queueIndex: number,
    experimentType: ExperimentType,
    summary: Awaited<ReturnType<typeof getRespondentAccuracySummary>>
) {
    return {
        queueIndex,
        experimentType,
        queueAccuracy: summary.queueAccuracy,
        respondentAverageAccuracy: summary.respondentAverageAccuracy,
        queuesCompleted: summary.queuesCompleted,
        /** @deprecated Use queueAccuracy */
        averageAccuracy: summary.queueAccuracy,
    }
}

export async function GET(request: NextRequest) {
    const authorId = getParticipantAuthorId(request)
    const experimentType = parseExperimentType(request.nextUrl.searchParams.get("experimentType"))
    const queueRaw = Number(request.nextUrl.searchParams.get("queueIndex") ?? "0")
    const queueIndex = Number.isFinite(queueRaw) && queueRaw >= 0 ? Math.floor(queueRaw) : 0
    const scope = parseScope(request.nextUrl.searchParams.get("scope"))

    if (scope === "summary") {
        const summary = await getRespondentAccuracySummary(authorId, experimentType, queueIndex)
        return NextResponse.json(summaryPayload(queueIndex, experimentType, summary))
    }

    if (scope === "analytics") {
        const [summary, respondentInstitutionKey] = await Promise.all([
            getRespondentAccuracySummary(authorId, experimentType, queueIndex),
            getRespondentInstitutionKeyForExperiment(authorId, experimentType),
        ])
        const comparisonScore =
            summary.respondentAverageAccuracy ?? summary.queueAccuracy ?? null
        const { distribution, leaderboard } = await getExperimentThankYouAnalytics(
            experimentType,
            comparisonScore,
            respondentInstitutionKey
        )

        return NextResponse.json({
            queueIndex,
            experimentType,
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
        })
    }

    const [summary, respondentInstitutionKey] = await Promise.all([
        getRespondentAccuracySummary(authorId, experimentType, queueIndex),
        getRespondentInstitutionKeyForExperiment(authorId, experimentType),
    ])
    const comparisonScore = summary.respondentAverageAccuracy ?? summary.queueAccuracy ?? null
    const { distribution, leaderboard } = await getExperimentThankYouAnalytics(
        experimentType,
        comparisonScore,
        respondentInstitutionKey
    )

    return NextResponse.json({
        ...summaryPayload(queueIndex, experimentType, summary),
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
    })
}
