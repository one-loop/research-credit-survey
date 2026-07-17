"use client"

import { useState, useEffect, Suspense, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"
import { useExperimentReturnCheck } from "@/lib/useExperimentReturnCheck"
import { SurveyThanksPanel } from "@/components/SurveyThanksPanel"
import { Button } from "@/components/ui/button"
import { ConfirmRankingOrderDialog } from "@/components/ConfirmRankingOrderDialog"
import type { Work, Author } from "@/lib/types"
import { AuthorContributionsMatrix } from "@/components/AuthorContributionsMatrix"
import { AuthorBylineRankingBoard } from "@/components/AuthorBylineRankingBoard"
import { trialFailedKey, trialPassedKey } from "@/lib/trialWorks"
import { readPreTaskBeliefsForSubmit } from "@/lib/survey/preTaskBeliefs"
import { publicationCorrespondingSlotIndex, shuffledAuthorsForRanking } from "@/lib/shuffleAuthors"
import { useExperimentRankingTiming } from "@/lib/useExperimentRankingTiming"
import { SurveyLoadingScreen } from "@/components/SurveyLoadingScreen"
import { TaskTransition } from "@/components/SurveyMotion"
import { logExperimentTaskDebug } from "@/lib/survey/experimentTaskDebug"
import { ExperimentCAcademicInfoTable } from "@/components/ExperimentCAcademicInfoTable"

function ExperimentCPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { authorId, ready: participantReady } = useSurveyParticipant()
    const queueIndexRaw = Number(searchParams.get("queue") ?? "0")
    const queueIndex = Number.isFinite(queueIndexRaw) && queueIndexRaw >= 0 ? Math.floor(queueIndexRaw) : 0
    const returnCheck = useExperimentReturnCheck("C", queueIndex)

    const [trialGate, setTrialGate] = useState<"pending" | "failed" | "ok">("pending")
    const [works, setWorks] = useState<Work[] | null>(null)
    const [dataSource, setDataSource] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [trialResults, setTrialResults] = useState<string[][]>([])
    const [rankingAuthors, setRankingAuthors] = useState<Author[]>([])
    const [initialShuffledOrderKey, setInitialShuffledOrderKey] = useState("")
    const [showIntro, setShowIntro] = useState(true)
    const [confirmUnchangedOpen, setConfirmUnchangedOpen] = useState(false)
    const [respondentDomain, setRespondentDomain] = useState<string | null>(null)
    const [respondentJournal, setRespondentJournal] = useState<string | null>(null)
    const [showLoadingScreen, setShowLoadingScreen] = useState(true)
    const [loadingScreenFading, setLoadingScreenFading] = useState(false)
    const [submittingFadeOut, setSubmittingFadeOut] = useState(false)

    useEffect(() => {
        if (!participantReady || !returnCheck.ready) return
        if (typeof window === "undefined") return
        if (returnCheck.hasPriorResponses) {
            setTrialGate("ok")
            return
        }
        if (sessionStorage.getItem(trialFailedKey(authorId)) === "true") {
            setTrialGate("failed")
            return
        }
        if (sessionStorage.getItem(trialPassedKey(authorId)) !== "true") {
            router.replace("/trial")
            return
        }
        setTrialGate("ok")
    }, [participantReady, returnCheck.ready, returnCheck.hasPriorResponses, authorId, router])

    useEffect(() => {
        if (!participantReady || trialGate !== "ok" || returnCheck.showThanks) return

        const params = new URLSearchParams()

        setLoading(true)
        setError(null)

        const keyAuthor = authorId ?? "none"
        const storageKey = `experimentWorks_${keyAuthor}`

        let usedPrefetch = false

        if (typeof window !== "undefined" && queueIndex === 0) {
            const stored = window.sessionStorage.getItem(storageKey)
            if (stored) {
                try {
                    const parsed = JSON.parse(stored) as { works: Work[]; dataSource?: string }
                    const incoming = parsed.works ?? []
                    if (parsed.dataSource) setDataSource(parsed.dataSource)
                    const shuffled = [...incoming]
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1))
                        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
                    }
                    setWorks(shuffled)
                    if (shuffled.length > 0) {
                        setRankingAuthors([])
                        setInitialShuffledOrderKey("")
                    }
                    setError(null)
                    setLoading(false)
                    usedPrefetch = true
                } catch (err) {
                    console.error("[experiment-c] failed to parse prefetched works from sessionStorage:", err)
                }
            }
        }

        if (usedPrefetch) return

        params.set("experimentType", "C")
        params.set("queueIndex", String(queueIndex))
        fetch(`/api/survey/works?${params.toString()}`, { credentials: "same-origin" })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load works")
                return res.json()
            })
            .then((data: { works: Work[]; dataSource?: string }) => {
                const incoming = data.works ?? []
                if (data.dataSource) setDataSource(data.dataSource)
                const shuffled = [...incoming]
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
                }

                setWorks(shuffled)
                if (shuffled.length > 0) {
                    setRankingAuthors([])
                    setInitialShuffledOrderKey("")
                }
                setError(null)
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
            .finally(() => setLoading(false))
    }, [participantReady, authorId, trialGate, queueIndex, returnCheck.showThanks])

    useEffect(() => {
        if (typeof window === "undefined") return
        const keyAuthor = authorId ?? "none"
        const raw = window.sessionStorage.getItem(`respondentContext_${keyAuthor}`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as { domain?: string | null; journal?: string | null }
            setRespondentDomain(parsed.domain ?? null)
            setRespondentJournal(parsed.journal ?? null)
        } catch {
            // ignore malformed cached context
        }
    }, [authorId])

    useEffect(() => {
        if (loading) {
            setShowLoadingScreen(true)
            setLoadingScreenFading(false)
            return
        }
        if (!showLoadingScreen) return
        setLoadingScreenFading(true)
        const handle = window.setTimeout(() => {
            setShowLoadingScreen(false)
        }, 320)
        return () => window.clearTimeout(handle)
    }, [loading, showLoadingScreen])

    const totalWorks = works?.length ?? 0
    const isComplete = totalWorks > 0 && currentIndex >= totalWorks
    const currentWork = works && totalWorks > 0 ? works[currentIndex] : null
    const displayAuthors = useMemo(
        () => (currentWork ? shuffledAuthorsForRanking(currentWork.authors) : []),
        [currentWork?.work_id]
    )

    const rankingUiActive =
        trialGate === "ok" &&
        !loading &&
        !error &&
        Boolean(works && totalWorks > 0 && currentWork && !showIntro && !isComplete)

    const { minTimeMet, orderUnchangedFromInitial, flushCurrentWorkSeconds, secondsByWorkIdRef } =
        useExperimentRankingTiming({
            workId: currentWork?.work_id,
            isRankingUiActive: rankingUiActive,
            items: rankingAuthors,
            initialShuffledOrderKey,
        })

    const handleRankingChange = useCallback((ranking: Author[], poolOrderKey: string) => {
        setRankingAuthors(ranking)
        if (poolOrderKey) setInitialShuffledOrderKey(poolOrderKey)
    }, [])

    const allSlotsFilled =
        displayAuthors.length > 0 && rankingAuthors.length === displayAuthors.length

    useEffect(() => {
        if (!currentWork || showIntro || isComplete) return
        logExperimentTaskDebug({
            experimentType: "C",
            taskIndex: currentIndex,
            work: currentWork,
            dataSource,
        })
    }, [currentWork, currentIndex, dataSource, showIntro, isComplete])

    function requestAdvance() {
        if (!works || !currentWork) return
        if (!minTimeMet || !allSlotsFilled) return
        if (orderUnchangedFromInitial) {
            setConfirmUnchangedOpen(true)
            return
        }
        void executeAdvance()
    }

    async function executeAdvance() {
        if (!works || !currentWork) return
        flushCurrentWorkSeconds(currentWork.work_id)
        setConfirmUnchangedOpen(false)

        const ranking = rankingAuthors.map((author) => author.id)
        const newResults = [...trialResults, ranking]

        if (currentIndex < totalWorks - 1) {
            setTrialResults(newResults)
            setCurrentIndex(currentIndex + 1)
            setRankingAuthors([])
            setInitialShuffledOrderKey("")
        } else {
            setTrialResults(newResults)
            setCurrentIndex(totalWorks)

            const workIds = works.map((w) => w.work_id)
            const ownWorkId = works.find((w) => w.isOwnWork)?.work_id ?? null
            const rankings: Record<string, string[]> = {}
            works.forEach((w, i) => {
                rankings[w.work_id] = newResults[i] ?? []
            })

            const timeSpent = { ...secondsByWorkIdRef.current }

            let roleImportance: Record<string, number> | undefined
            if (typeof window !== "undefined") {
                const keyAuthor = authorId ?? "none"
                const storageKey = `roleImportance_${keyAuthor}`
                const stored = window.sessionStorage.getItem(storageKey)
                if (stored) {
                    try {
                        roleImportance = JSON.parse(stored) as Record<string, number>
                    } catch (err) {
                        console.error("[experiment-c] failed to parse roleImportance from sessionStorage:", err)
                    }
                }
            }

            let respondentDemographics: Record<string, string> | undefined
            if (typeof window !== "undefined") {
                const keyAuthor = authorId ?? "none"
                const storedDemographics = window.sessionStorage.getItem(`respondentDemographics_${keyAuthor}`)
                if (storedDemographics) {
                    try {
                        respondentDemographics = JSON.parse(storedDemographics) as Record<string, string>
                    } catch (err) {
                        console.error("[experiment-c] failed to parse respondent demographics from sessionStorage:", err)
                    }
                }
            }

            const { creditRolePositionBeliefs, authorPositionBeliefs } =
                readPreTaskBeliefsForSubmit(authorId)

            try {
                const res = await fetch("/api/survey/complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        workIds,
                        rankings,
                        authorId,
                        ownWorkId,
                        roleImportance,
                        experimentType: "C",
                        timeSpent,
                        respondentDemographics,
                        creditRolePositionBeliefs,
                        authorPositionBeliefs,
                    }),
                })
                const data = (await res.json()) as {
                    ok?: boolean
                    responseId?: string
                    queueIndex?: number
                    queueAccuracy?: number | null
                    respondentAverageAccuracy?: number | null
                    queuesCompleted?: number
                    averageAccuracy?: number | null
                    error?: string
                }
                if (!res.ok || !data.ok || !data.responseId) {
                    setError(data.error ?? "Failed to submit rankings")
                    return
                }
                const savedResponseId = data.responseId
                const savedQueue =
                    typeof data.queueIndex === "number" && data.queueIndex >= 0
                        ? data.queueIndex
                        : queueIndex
                if (typeof window !== "undefined") {
                    window.sessionStorage.setItem(
                        `responseId_C_${savedQueue}`,
                        savedResponseId
                    )
                }
                setSubmittingFadeOut(true)
                window.setTimeout(() => {
                    router.replace(
                        `/consent?experimentType=C&queue=${savedQueue}&responseId=${encodeURIComponent(savedResponseId)}`
                    )
                }, 220)
            } catch {
                setError("Failed to submit rankings")
            }
        }
    }

    if (!returnCheck.ready || trialGate === "pending") {
        return <SurveyLoadingScreen message="Checking session…" />
    }

    if (returnCheck.showThanks) {
        return <SurveyThanksPanel experimentType="C" queue={returnCheck.latestQueueIndex} />
    }

    if (trialGate === "failed") {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Survey ended</h1>
                <p className="text-muted-foreground leading-relaxed">
                    This session cannot continue because the instruction check was not completed successfully.
                    Thank you for your time.
                </p>
            </div>
        )
    }

    if (showLoadingScreen) {
        return (
            <SurveyLoadingScreen
                message="Loading works…"
                fading={loadingScreenFading}
            />
        )
    }

    if (error || !works || totalWorks === 0) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Experiment C</h1>
                <p className="text-destructive">
                    {error ?? "No works available. Try again later."}
                </p>
            </div>
        )
    }

    if (isComplete) {
        return (
            <SurveyLoadingScreen
                message="Submitting your responses…"
                fading={submittingFadeOut}
                fastFade
            />
        )
    }

    if (showIntro && !isComplete) {
        const introDomain = currentWork?.domain ?? respondentDomain ?? "your domain"
        const introJournal = respondentJournal ?? currentWork?.journal ?? "your journal"
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Before You Begin</h1>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    You are about to see a sample of <span className="font-semibold text-black">5 papers</span> that belong to the{" "}
                    <span className="">{introDomain}</span> domain and are published in{" "}
                    <span className="">{introJournal}</span>. All author names/initials are anonymized.
                </p>
                <div className="flex justify-end">
                    <Button onClick={() => setShowIntro(false)}>Begin main study</Button>
                </div>
            </div>
        )
    }

    const envelopeSlotIndex = currentWork ? publicationCorrespondingSlotIndex(currentWork.authors) : -1

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">
                    Author Contribution Ranking: Task {currentIndex + 1}
                </h1>
                <div className="mt-2 w-full bg-secondary rounded-full h-2">
                    <div
                        className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${((currentIndex + 1) / totalWorks) * 100}%` }}
                    />
                </div>
            </div>

            {currentWork && (
                <TaskTransition taskKey={currentIndex}>
                <>
                    <div className="mb-6 space-y-2">
                        <p className="text-lg font-medium">Author contributions</p>
                        <p className="text-sm text-muted-foreground">
                            You can hover over a role name to see more information about it.
                        </p>
                        <AuthorContributionsMatrix authors={displayAuthors} />
                    </div>
                    <ExperimentCAcademicInfoTable
                        authors={displayAuthors}
                        getAuthorLabel={(author) => author.initials}
                        title="🎓 Academic information"
                        className="mb-6"
                    />

                    <div className="mb-6">
                        <p className="font-medium mb-8">
                            Given the information above, please sort these authors in the way you think they would
                            appear on the byline of the {currentWork.journal} journal in the{" "}
                            {currentWork.domain ?? "relevant"} domain.
                        </p>
                        {/* <p className="mb-12 text-muted-foreground text-sm">
                            <Mail className="h-3.5 w-3.5 inline stroke-violet-950 text-violet-950" /> Your choice of corresponding author once you submit. The position at which the corresponding author occurs is fixed
                        </p> */}
                        <AuthorBylineRankingBoard
                            key={currentWork.work_id}
                            authors={displayAuthors}
                            envelopeSlotIndex={envelopeSlotIndex}
                            renderAuthorLabel={(author) => author.initials}
                            onRankingChange={handleRankingChange}
                        />
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {!allSlotsFilled ? (
                            <p className="text-xs text-muted-foreground">
                                Drag each author into a byline slot to continue.
                            </p>
                        ) : null}
                        {!minTimeMet ? (
                            <p className="text-xs text-muted-foreground">Wait at least 10 seconds before continuing.</p>
                        ) : null}
                        <Button onClick={() => void requestAdvance()} disabled={!minTimeMet || !allSlotsFilled}>
                            {currentIndex < totalWorks - 1 ? "Next Work" : "Complete"}
                        </Button>
                    </div>
                </>
                </TaskTransition>
            )}
            <ConfirmRankingOrderDialog
                open={confirmUnchangedOpen}
                onCancel={() => setConfirmUnchangedOpen(false)}
                onConfirm={() => void executeAdvance()}
            />
        </div>
    )
}

export default function ExperimentCPage() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        }>
            <ExperimentCPageContent />
        </Suspense>
    )
}

