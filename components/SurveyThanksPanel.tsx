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
import { FadeIn } from "@/components/SurveyMotion"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"
import type { AccuracyHistogramBin } from "@/lib/survey/accuracyDistribution"
import {
    accuracyPercentileRank,
    buildAccuracyHistogram,
    hasEnoughResponsesForGlobalAnalytics,
} from "@/lib/survey/accuracyDistribution"
import { mockAccuracySamples } from "@/lib/survey/mockDistributionSamples"
import type { InstitutionLeaderboardEntry } from "@/lib/survey/institutionLeaderboard"
import { formatOrdinal } from "@/lib/survey/percentileFormat"

type Props = {
    experimentType: ExperimentType
    queue: number
    /** Dev preview: simulate N sample blocks for the distribution chart. */
    mockDistributionSamples?: number
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

export function SurveyThanksPanel({
    experimentType,
    queue,
    mockDistributionSamples = 0,
}: Props) {
    const nextQueue = queue + 1
    const continueHref =
        experimentType === "B"
            ? `/experiment-b?queue=${nextQueue}`
            : experimentType === "C"
              ? `/experiment-c?queue=${nextQueue}`
              : `/experiment-a?queue=${nextQueue}`
    const studyCompleteHref = `/study-complete?experimentType=${experimentType}&queue=${queue}`

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
    const globalAnalyticsReady =
        mockDistributionSamples > 0 ||
        hasEnoughResponsesForGlobalAnalytics(distribution?.responseCount ?? 0)
    const showDistributionChart =
        globalAnalyticsReady && (distribution?.show === true || mockDistributionSamples > 0)
    const chartPreview = useMemo(() => {
        if (mockDistributionSamples <= 0) return null

        const comparisonScore =
            (typeof respondentAverageAccuracy === "number"
                ? respondentAverageAccuracy
                : null) ??
            (typeof queueAccuracy === "number" ? queueAccuracy : null) ??
            0.74

        const mockScores = mockAccuracySamples(mockDistributionSamples)

        return {
            bins: buildAccuracyHistogram(mockScores),
            responseCount: mockDistributionSamples,
            comparisonScore,
            percentile: accuracyPercentileRank(comparisonScore, mockScores),
            previewNote: `Simulated preview using ${mockDistributionSamples} sample block scores (dev only). Remove ?mockDistribution from the URL to see real data.`,
        }
    }, [mockDistributionSamples, respondentAverageAccuracy, queueAccuracy])
    const showLeaderboard =
        globalAnalyticsReady &&
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

        if (
            globalAnalyticsReady &&
            percentileSummary?.overall !== null &&
            percentileSummary?.overall !== undefined
        ) {
            cards.push({
                id: "percentile",
                label: "All participants",
                value: formatOrdinal(percentileSummary.overall),
                description: "Your percentile rank",
            })
        }

        if (
            globalAnalyticsReady &&
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
        globalAnalyticsReady,
    ])

    const statsSkeletonCount =
        (summaryLoading ? 2 : 0) + (analyticsLoading && globalAnalyticsReady ? 2 : 0)
    const showStatsGrid = statCards.length > 0 || statsSkeletonCount > 0
    const showInsightsSection =
        showStatsGrid || showDistributionChart || showLeaderboard
    const wideLayout =
        analyticsLoading || showDistributionChart || showLeaderboard

    return (
        <div className={`mx-auto overflow-visible p-6 ${wideLayout ? "max-w-xl" : "max-w-lg"}`}>
            <ThankYouConfetti />
            <FadeIn>
                <h1 className="text-3xl font-bold tracking-tight mb-4">Thank you</h1>
                <p className="text-base text-muted-foreground leading-relaxed mb-5">
                    Your responses are complete. We appreciate you taking the time to participate in this study. Here are your results:
                </p>
            </FadeIn>
            {showInsightsSection ? (
                <FadeIn delay={80} className="mb-6 space-y-4 overflow-visible">
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
                            {analyticsLoading && globalAnalyticsReady && !chartPreview ? (
                                <>
                                    <AccuracyDistributionChartSkeleton />
                                    <InstitutionLeaderboardSkeleton />
                                </>
                            ) : (
                                <>
                                    {showDistributionChart && (chartPreview || distribution) ? (
                                        <AccuracyDistributionChart
                                            bins={
                                                chartPreview?.bins ?? distribution!.bins
                                            }
                                            comparisonScore={
                                                chartPreview?.comparisonScore ??
                                                distribution!.comparisonScore
                                            }
                                            percentile={
                                                chartPreview?.percentile ??
                                                distribution!.percentile ??
                                                percentileSummary?.overall ??
                                                null
                                            }
                                            responseCount={
                                                chartPreview?.responseCount ??
                                                distribution!.responseCount
                                            }
                                            previewNote={chartPreview?.previewNote}
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
                </FadeIn>
            ) : null}
            <FadeIn delay={160} className="mt-6 space-y-4 border-t pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You can improve your accuracy by completing another block of 5 tasks. Each block
                    updates your average score and where you rank among other participants.
                </p>
                <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4 space-y-4">
                    <div>
                        <p className="text-base font-semibold text-foreground">
                            Ready for another round?
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            Five more papers take just a few minutes, and will give you another chance
                            to raise your accuracy and percentile.
                        </p>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                        <Button variant="outline" asChild className="sm:min-w-[7.5rem]">
                            <Link href={studyCompleteHref}>I&apos;m done</Link>
                        </Button>
                        <Button asChild className="sm:min-w-[12rem]">
                            <Link href={continueHref}>Keep going, 5 more tasks!</Link>
                        </Button>
                    </div>
                </div>
            </FadeIn>
        </div>
    )
}
