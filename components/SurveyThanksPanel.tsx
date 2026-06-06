"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AccuracyCalculationInfo } from "@/components/AccuracyCalculationInfo"
import { AccuracyDistributionChart } from "@/components/AccuracyDistributionChart"
import {
    SurveyResultsStatsGrid,
    type SurveyStatCard,
} from "@/components/SurveyResultsStatsGrid"
import { AccuracyDistributionChartSkeleton } from "@/components/AccuracyDistributionChartSkeleton"
import { InstitutionLeaderboard } from "@/components/InstitutionLeaderboard"
import { InstitutionLeaderboardSkeleton } from "@/components/InstitutionLeaderboardSkeleton"
import { Button } from "@/components/ui/button"
import { ThankYouAnalyticsConfetti, ThankYouConfetti } from "@/components/ThankYouConfetti"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"
import type { AccuracyHistogramBin } from "@/lib/survey/accuracyDistribution"
import type { InstitutionLeaderboardEntry } from "@/lib/survey/institutionLeaderboard"
import { formatOrdinal } from "@/lib/survey/percentileFormat"

type Props = {
    experimentType: ExperimentType
    queue: number
}

function formatAccuracyPercent(accuracy: number): string {
    return `${Math.round(accuracy * 100)}%`
}

function queueAccuracyQuery(experimentType: ExperimentType, queue: number, scope: string) {
    const params = new URLSearchParams({
        experimentType,
        queueIndex: String(queue),
        scope,
    })
    return `/api/survey/queue-accuracy?${params.toString()}`
}

export function SurveyThanksPanel({ experimentType, queue }: Props) {
    const nextQueue = queue + 1
    const continueHref =
        experimentType === "B"
            ? `/experiment-b?queue=${nextQueue}`
            : experimentType === "C"
              ? `/experiment-c?queue=${nextQueue}`
              : `/experiment-a?queue=${nextQueue}`

    const [summaryLoading, setSummaryLoading] = useState(true)
    const [analyticsLoading, setAnalyticsLoading] = useState(true)
    const [queueAccuracy, setQueueAccuracy] = useState<number | null>(null)
    const [respondentAverageAccuracy, setRespondentAverageAccuracy] = useState<number | null>(
        null
    )
    const [queuesCompleted, setQueuesCompleted] = useState<number | undefined>(undefined)
    const [distribution, setDistribution] = useState<{
        show: boolean
        responseCount: number
        bins: AccuracyHistogramBin[]
        percentile: number | null
        comparisonScore: number | null
    } | null>(null)
    const [leaderboard, setLeaderboard] = useState<{
        top10: InstitutionLeaderboardEntry[]
        respondent: InstitutionLeaderboardEntry | null
        highlightInstitutionKey: string | null
    } | null>(null)
    const [percentileSummary, setPercentileSummary] = useState<{
        overall: number | null
        institution: number | null
    } | null>(null)

    useEffect(() => {
        let cancelled = false
        setSummaryLoading(true)

        fetch(queueAccuracyQuery(experimentType, queue, "summary"), { credentials: "same-origin" })
            .then((res) => (res.ok ? res.json() : Promise.resolve({})))
            .then(
                (data: {
                    queueAccuracy?: number | null
                    respondentAverageAccuracy?: number | null
                    queuesCompleted?: number
                    averageAccuracy?: number | null
                }) => {
                    if (cancelled) return
                    const block =
                        typeof data.queueAccuracy === "number"
                            ? data.queueAccuracy
                            : typeof data.averageAccuracy === "number"
                              ? data.averageAccuracy
                              : null
                    setQueueAccuracy(block)
                    setRespondentAverageAccuracy(
                        typeof data.respondentAverageAccuracy === "number" &&
                            Number.isFinite(data.respondentAverageAccuracy)
                            ? data.respondentAverageAccuracy
                            : null
                    )
                    setQueuesCompleted(
                        typeof data.queuesCompleted === "number" ? data.queuesCompleted : undefined
                    )
                }
            )
            .catch(() => {
                if (!cancelled) {
                    setQueueAccuracy(null)
                    setRespondentAverageAccuracy(null)
                }
            })
            .finally(() => {
                if (!cancelled) setSummaryLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [experimentType, queue])

    useEffect(() => {
        let cancelled = false
        setAnalyticsLoading(true)

        fetch(queueAccuracyQuery(experimentType, queue, "analytics"), {
            credentials: "same-origin",
        })
            .then((res) => (res.ok ? res.json() : Promise.resolve({})))
            .then(
                (data: {
                    distribution?: {
                        show?: boolean
                        responseCount?: number
                        bins?: AccuracyHistogramBin[]
                        percentile?: number | null
                        comparisonScore?: number | null
                        institutionPercentile?: number | null
                    }
                    leaderboard?: {
                        top10?: InstitutionLeaderboardEntry[]
                        respondent?: InstitutionLeaderboardEntry | null
                        highlightInstitutionKey?: string | null
                    }
                }) => {
                    if (cancelled) return

                    setPercentileSummary({
                        overall:
                            typeof data.distribution?.percentile === "number"
                                ? data.distribution.percentile
                                : null,
                        institution:
                            typeof data.distribution?.institutionPercentile === "number"
                                ? data.distribution.institutionPercentile
                                : null,
                    })

                    if (data.distribution?.show && data.distribution.bins?.length) {
                        setDistribution({
                            show: true,
                            responseCount: data.distribution.responseCount ?? 0,
                            bins: data.distribution.bins,
                            percentile:
                                typeof data.distribution.percentile === "number"
                                    ? data.distribution.percentile
                                    : null,
                            comparisonScore:
                                typeof data.distribution.comparisonScore === "number"
                                    ? data.distribution.comparisonScore
                                    : null,
                        })
                    } else {
                        setDistribution(null)
                    }

                    if (data.leaderboard?.top10?.length || data.leaderboard?.respondent) {
                        setLeaderboard({
                            top10: data.leaderboard.top10 ?? [],
                            respondent: data.leaderboard.respondent ?? null,
                            highlightInstitutionKey:
                                data.leaderboard.highlightInstitutionKey ?? null,
                        })
                    } else {
                        setLeaderboard(null)
                    }
                }
            )
            .catch(() => {
                if (!cancelled) {
                    setDistribution(null)
                    setLeaderboard(null)
                    setPercentileSummary(null)
                }
            })
            .finally(() => {
                if (!cancelled) setAnalyticsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [experimentType, queue])

    const completed = queuesCompleted ?? 0
    const showBlockAccuracy = typeof queueAccuracy === "number"
    const showOverallAccuracy = typeof respondentAverageAccuracy === "number" && completed >= 1
    const showSeparateOverall =
        showOverallAccuracy &&
        completed > 1 &&
        (typeof queueAccuracy !== "number" ||
            Math.round(respondentAverageAccuracy! * 100) !== Math.round(queueAccuracy * 100))
    const showDistributionChart = distribution?.show === true
    const showLeaderboard =
        leaderboard !== null &&
        (leaderboard.top10.length > 0 || leaderboard.respondent !== null)
    const statCards = useMemo(() => {
        const cards: SurveyStatCard[] = []

        if (showBlockAccuracy && typeof queueAccuracy === "number") {
            cards.push({
                id: "block",
                label: "Last 5 tasks",
                value: formatAccuracyPercent(queueAccuracy),
                description: "Most recent block accuracy",
            })
        }

        if (showSeparateOverall && typeof respondentAverageAccuracy === "number") {
            cards.push({
                id: "overall",
                label: "Total average",
                value: formatAccuracyPercent(respondentAverageAccuracy),
                description: `Across ${completed} completed blocks`,
            })
        } else if (showOverallAccuracy && !showBlockAccuracy && typeof respondentAverageAccuracy === "number") {
            cards.push({
                id: "overall",
                label: "Total average",
                value: formatAccuracyPercent(respondentAverageAccuracy),
                description:
                    completed === 1 ? "This block" : `Across ${completed} completed blocks`,
            })
        }

        if (percentileSummary?.overall !== null && percentileSummary?.overall !== undefined) {
            cards.push({
                id: "percentile",
                label: "All participants",
                value: formatOrdinal(percentileSummary.overall),
                description: "Your percentile rank",
            })
        }

        if (
            percentileSummary?.institution !== null &&
            percentileSummary?.institution !== undefined
        ) {
            cards.push({
                id: "institution-percentile",
                label: "Your institution",
                value: formatOrdinal(percentileSummary.institution),
                description: "Percentile at your institution",
            })
        }

        return cards
    }, [
        showBlockAccuracy,
        queueAccuracy,
        showSeparateOverall,
        respondentAverageAccuracy,
        completed,
        showOverallAccuracy,
        percentileSummary,
    ])

    const statsSkeletonCount =
        (summaryLoading ? 2 : 0) + (analyticsLoading ? 2 : 0)
    const showStatsGrid = statCards.length > 0 || statsSkeletonCount > 0
    const showInsightsSection =
        showStatsGrid || showDistributionChart || showLeaderboard
    const wideLayout =
        analyticsLoading || showDistributionChart || showLeaderboard

    return (
        <div className={`mx-auto overflow-visible p-6 ${wideLayout ? "max-w-xl" : "max-w-lg"}`}>
            <ThankYouConfetti />
            <h1 className="text-3xl font-bold tracking-tight mb-4">Thank you</h1>
            <p className="text-base text-muted-foreground leading-relaxed mb-5">
                Your responses are complete. We appreciate you taking the time to participate in this study. Here are your results:
            </p>
            {showInsightsSection ? (
                <div className="mb-6 space-y-4 overflow-visible">
                    {showStatsGrid ? (
                        <div className="space-y-3">
                            <SurveyResultsStatsGrid
                                stats={statCards}
                                skeletonCount={statsSkeletonCount}
                            />
                            {!summaryLoading && (showBlockAccuracy || showOverallAccuracy) ? (
                                <AccuracyCalculationInfo />
                            ) : null}
                        </div>
                    ) : null}
                    <div className="relative overflow-visible">
                        <ThankYouAnalyticsConfetti
                            active={
                                !analyticsLoading &&
                                (showDistributionChart || showLeaderboard)
                            }
                        />
                        <div className="relative z-10 space-y-4">
                            {analyticsLoading ? (
                                <>
                                    <AccuracyDistributionChartSkeleton />
                                    <InstitutionLeaderboardSkeleton />
                                </>
                            ) : (
                                <>
                                    {showDistributionChart && distribution ? (
                                        <AccuracyDistributionChart
                                            bins={distribution.bins}
                                            comparisonScore={distribution.comparisonScore}
                                            responseCount={distribution.responseCount}
                                        />
                                    ) : null}
                                    {showLeaderboard && leaderboard ? (
                                        <InstitutionLeaderboard
                                            top10={leaderboard.top10}
                                            respondent={leaderboard.respondent}
                                            highlightInstitutionKey={
                                                leaderboard.highlightInstitutionKey
                                            }
                                        />
                                    ) : null}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="flex justify-end">
                <Button asChild>
                    <Link href={continueHref}>Do 5 more tasks</Link>
                </Button>
            </div>
        </div>
    )
}
