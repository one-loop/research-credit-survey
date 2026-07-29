"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
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

import { useRouter } from "next/navigation"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"
import { Spinner } from "@/components/ui/spinner"

type Props = {
    experimentType: ExperimentType
    queue: number
    /** Dev preview: simulate N sample blocks for the distribution chart. */
    mockDistributionSamples?: number
    consent?: string | null
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
    consent,
}: Props) {
    const router = useRouter()
    const { authorId } = useSurveyParticipant()
    const [checkingConsent, setCheckingConsent] = useState(false)

    const handleFinishStudy = useCallback(async () => {
        setCheckingConsent(true)
        try {
            const allSessionResponseIds: string[] = []
            if (typeof window !== "undefined") {
                for (let q = 0; q <= queue; q++) {
                    const id = window.sessionStorage.getItem(`responseId_${experimentType}_${q}`)
                    if (id) allSessionResponseIds.push(id)
                }
            }

            const queryParts: string[] = []
            if (allSessionResponseIds.length > 0) {
                queryParts.push(`responseIds=${encodeURIComponent(allSessionResponseIds.join(","))}`)
            }
            if (authorId) {
                queryParts.push(`authorId=${encodeURIComponent(authorId)}`)
            }

            if (queryParts.length > 0) {
                const res = await fetch(`/api/survey/verification?${queryParts.join("&")}`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.ok && data.ownPapers && data.ownPapers.length > 0 && !data.alreadyConsented) {
                        const refIds = allSessionResponseIds.length > 0 ? allSessionResponseIds.join(",") : data.ownPapers[0]?.responseId || ""
                        router.push(
                            `/consent?experimentType=${experimentType}&queue=${queue}&responseIds=${encodeURIComponent(refIds)}`
                        )
                        return
                    }
                }
            }
        } catch {
            // fallback to study-complete
        } finally {
            setCheckingConsent(false)
        }
        router.push(`/study-complete?experimentType=${experimentType}&queue=${queue}`)
    }, [experimentType, queue, authorId, router])
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
            {consent !== "withdrawn" && <ThankYouConfetti />}
            {consent === "consented" && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-2xl p-4 mb-6 flex items-start gap-3 shadow-lg shadow-emerald-500/5 animate-in fade-in slide-in-from-top-4 duration-300">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                        <div className="font-bold text-sm">Response Consented</div>
                        <div className="text-xs opacity-90 mt-0.5">Your consent has been successfully registered. Thank you for participating in the study!</div>
                    </div>
                </div>
            )}
            {consent === "withdrawn" && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 rounded-2xl p-4 mb-6 flex items-start gap-3 shadow-lg shadow-rose-500/5 animate-in fade-in slide-in-from-top-4 duration-300">
                    <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                    <div>
                        <div className="font-bold text-sm">Response Withdrawn</div>
                        <div className="text-xs opacity-90 mt-0.5">As requested, your response for this paper will not be included or used in our research study.</div>
                    </div>
                </div>
            )}
            {consent === "not_my_paper" && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-2xl p-4 mb-6 flex items-start gap-3 shadow-lg shadow-amber-500/5 animate-in fade-in slide-in-from-top-4 duration-300">
                    <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                        <div className="font-bold text-sm">Not Identified as Your Paper</div>
                        <div className="text-xs opacity-90 mt-0.5">You indicated that this was not your paper. Your response will not be included in the own-paper sub-analysis.</div>
                    </div>
                </div>
            )}
            <FadeIn>
                <h1 className="text-3xl font-bold tracking-tight mb-4">
                    {consent === "withdrawn"
                        ? "Thank you for taking part"
                        : consent === "not_my_paper"
                          ? "Thank you for participating"
                          : "Thank you"}
                </h1>
                <p className="text-base text-muted-foreground leading-relaxed mb-5">
                    {consent === "withdrawn"
                        ? "We appreciate you taking the time to participate in this study. As requested, your response for this paper has been withdrawn and will not be used in our research study. Below are your performance results for your own reference:"
                        : consent === "not_my_paper"
                          ? "We appreciate you taking the time to participate in this study. Since you indicated that this was not your paper, your response will not be included in the own-paper sub-analysis. Below are your performance results:"
                          : "Your responses are complete. We appreciate you taking the time to participate in this study. Here are your results:"}
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
            {!consent ? (
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
                            <Button
                                variant="outline"
                                onClick={() => void handleFinishStudy()}
                                disabled={checkingConsent}
                                className="sm:min-w-[7.5rem]"
                            >
                                {checkingConsent && <Spinner className="mr-2" />}
                                I&apos;m done
                            </Button>
                            <Button asChild className="sm:min-w-[12rem]">
                                <Link href={continueHref}>Keep going, 5 more tasks!</Link>
                            </Button>
                        </div>
                    </div>
                </FadeIn>
            ) : (
                <FadeIn delay={160} className="mt-6 flex justify-end border-t pt-6">
                    <Button
                        onClick={() => void handleFinishStudy()}
                        disabled={checkingConsent}
                        className="sm:min-w-[10rem]"
                    >
                        {checkingConsent && <Spinner className="mr-2" />}
                        Complete session
                    </Button>
                </FadeIn>
            )}
        </div>
    )
}
