"use client"

import { DndContext, closestCenter } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState, useEffect, Suspense, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ConfirmRankingOrderDialog } from "@/components/ConfirmRankingOrderDialog"
import { Mail } from "lucide-react"
import type { Work, Author } from "@/lib/types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { trialFailedKey, trialPassedKey } from "@/lib/trialWorks"
import { publicationCorrespondingSlotIndex, shuffledAuthorsForRanking } from "@/lib/shuffleAuthors"
import { useExperimentRankingTiming } from "@/lib/useExperimentRankingTiming"

const roleDetailsMap: Record<string, string> = {
    Conceptualization: "Ideas, formulation or evolution of overarching research goals and aims.",
    Methodology: "Development or design of methodology; creation of models.",
    Software: "Programming, software development, and implementation of code and supporting algorithms.",
    Validation: "Verification and reproducibility of results, experiments, or outputs.",
    "Formal analysis": "Application of formal techniques to analyze data.",
    "Formal Analysis": "Application of formal techniques to analyze data.",
    Investigation: "Conducting experiments or data/evidence collection.",
    Resources: "Provision of materials, instrumentation, computing resources, or other tools.",
    "Data curation": "Data annotation, cleaning, and maintenance for use/reuse.",
    "Writing – original draft": "Preparation and creation of the initial manuscript draft.",
    "Writing – review & editing": "Critical review, commentary, or revision of the manuscript.",
    Visualization: "Preparation and creation of visual representations and data presentations.",
    Supervision: "Oversight and leadership responsibility for planning and execution.",
    "Project administration": "Management and coordination for planning and execution.",
    "Funding acquisition": "Acquisition of financial support for the project.",
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="border rounded p-3 bg-card cursor-grab active:cursor-grabbing min-w-[100px] bg-violet-50 border-violet-950 text-violet-950"
        >
            {children}
        </div>
    )
}

function ExperimentCPageContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const authorId = searchParams.get("authorId") ?? undefined

    const [trialGate, setTrialGate] = useState<"pending" | "failed" | "ok">("pending")
    const [works, setWorks] = useState<Work[] | null>(null)
    const [dataSource, setDataSource] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [trialResults, setTrialResults] = useState<string[][]>([])
    const [items, setItems] = useState<Author[]>([])
    const [showIntro, setShowIntro] = useState(true)
    const [confirmUnchangedOpen, setConfirmUnchangedOpen] = useState(false)
    const [respondentField, setRespondentField] = useState<string | null>(null)
    const [respondentJournal, setRespondentJournal] = useState<string | null>(null)

    useEffect(() => {
        if (typeof window === "undefined") return
        if (sessionStorage.getItem(trialFailedKey(authorId)) === "true") {
            setTrialGate("failed")
            return
        }
        if (sessionStorage.getItem(trialPassedKey(authorId)) !== "true") {
            router.replace(`/trial?authorId=${encodeURIComponent(authorId ?? "")}`)
            return
        }
        setTrialGate("ok")
    }, [authorId, router])

    useEffect(() => {
        if (trialGate !== "ok") return

        const params = new URLSearchParams()
        if (authorId) params.set("authorId", authorId)

        setLoading(true)
        setError(null)

        const keyAuthor = authorId ?? "none"
        const storageKey = `experimentWorks_${keyAuthor}`

        let usedPrefetch = false

        if (typeof window !== "undefined") {
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
                        setItems(shuffledAuthorsForRanking(shuffled[0].authors))
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
        fetch(`/api/survey/works?${params.toString()}`)
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
                    setItems(shuffledAuthorsForRanking(shuffled[0].authors))
                }
                setError(null)
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
            .finally(() => setLoading(false))
    }, [authorId, trialGate])

    useEffect(() => {
        if (typeof window === "undefined") return
        const keyAuthor = authorId ?? "none"
        const raw = window.sessionStorage.getItem(`respondentContext_${keyAuthor}`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as { field?: string | null; journal?: string | null }
            setRespondentField(parsed.field ?? null)
            setRespondentJournal(parsed.journal ?? null)
        } catch {
            // ignore malformed cached context
        }
    }, [authorId])

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
            items,
        })

    function handleDragEnd(event: { active: { id: unknown }; over: { id: unknown } | null }) {
        const { active, over } = event
        if (!over) return
        const activeId = String(active.id)
        const overId = String(over.id)
        if (activeId !== overId) {
            setItems((prev) => {
                const oldIndex = prev.findIndex((i) => i.id === activeId)
                const newIndex = prev.findIndex((i) => i.id === overId)
                return arrayMove(prev, oldIndex, newIndex)
            })
        }
    }

    function requestAdvance() {
        if (!works || !currentWork) return
        if (!minTimeMet) return
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

        const ranking = items.map((i) => i.id)
        const newResults = [...trialResults, ranking]

        if (currentIndex < totalWorks - 1) {
            setTrialResults(newResults)
            setCurrentIndex(currentIndex + 1)
            setItems(shuffledAuthorsForRanking(works[currentIndex + 1].authors))
        } else {
            setTrialResults(newResults)
            setCurrentIndex(totalWorks)

            const workIds = works.map((w) => w.work_id)
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

            try {
                const res = await fetch("/api/survey/complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        workIds,
                        rankings,
                        authorId,
                        roleImportance,
                        experimentType: "C",
                        timeSpent,
                        respondentDemographics,
                    }),
                })
                const data = (await res.json()) as { ok?: boolean; responseId?: string; error?: string }
                if (!res.ok || !data.ok || !data.responseId) {
                    setError(data.error ?? "Failed to submit rankings")
                    return
                }
                router.replace("/survey-thanks")
            } catch {
                setError("Failed to submit rankings")
            }
        }
    }

    if (trialGate === "pending") {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Checking session…</p>
            </div>
        )
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

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading works…</p>
            </div>
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
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Submitting your responses…</p>
            </div>
        )
    }

    if (showIntro && !isComplete) {
        const introField = respondentField ?? currentWork?.field ?? "your field"
        const introJournal = respondentJournal ?? currentWork?.journal ?? "your journal"
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Before You Begin</h1>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    You are about to see a sample of <span className="font-semibold text-black">5 papers</span> that belong to the{" "}
                    <span className="">{introField}</span> field and are published in{" "}
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
                <h1 className="text-2xl font-bold mb-2">Author Contribution Ranking</h1>
                <p className="text-muted-foreground">
                    Work {currentIndex + 1} of {totalWorks}
                </p>
                {currentWork && (
                    <p className={`mt-1 text-xs ${dataSource === "supabase" ? "text-green-600" : "text-muted-foreground"}`}>
                        [Debug] paper_id: {currentWork.work_id} | own_paper: {currentWork.isOwnWork ? "yes" : "no"} | data_source: {dataSource === "supabase" ? "Supabase (papers table)" : "mock data"}.
                    </p>
                )}
                <div className="mt-2 w-full bg-secondary rounded-full h-2">
                    <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${((currentIndex + 1) / totalWorks) * 100}%` }}
                    />
                </div>
            </div>

            {currentWork && (
                <>
                    <div className="mb-6 space-y-3">
                        <p className="text-lg font-medium mb-2">Author contributions</p>
                        <p className="text-sm text-muted-foreground">
                            You can hover over a contribution role to see more information about it.
                        </p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                            {displayAuthors.map((author) => (
                                <p key={author.id}>
                                    <span className="font-medium text-foreground">{author.initials}</span>:{" "}
                                    <TooltipProvider>
                                        {author.contributions.map((role, idx) => (
                                            <span key={`${author.id}-${role}-${idx}`}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help decoration-dotted underline-offset-4 hover:underline">
                                                            {role}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent sideOffset={6} className="max-w-sm leading-relaxed">
                                                        {/* <p className="font-semibold">{role}</p> */}
                                                        <p>{roleDetailsMap[role] ?? role}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                                {idx < author.contributions.length - 1 ? ", " : ""}
                                            </span>
                                        ))}
                                    </TooltipProvider>
                                </p>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                        <p className="font-medium mb-2">Academic Information:</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                            {displayAuthors.map((author) => (
                                <p key={author.id}>
                                    <span className="font-medium text-foreground">{author.initials}</span>: Top 100 institution:{" "}
                                    {author.top100_institution ? "Yes" : "No"}; Academic Age: {author.academic_age ?? "N/A"}; h-index: {author.h_index ?? "N/A"}
                                </p>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                        <p className="font-medium mb-6">
                            Given the information above, please sort these authors in the way you think they would
                            appear on the byline of the {currentWork.journal} journal in the{" "}
                            {currentWork.domain ?? currentWork.field ?? "relevant"} domain (left = highest contribution).
                        </p>
                        <p className="mb-12 text-muted-foreground text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground inline" /> Your choice of corresponding author once you submit. The position at which the corresponding author occurs is fixed
                        </p>
                        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={items.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
                                <div className="flex flex-row flex-wrap gap-3">
                                    {items.map((author, positionIndex) => {
                                        const showEnvelope = envelopeSlotIndex >= 0 && positionIndex === envelopeSlotIndex
                                        return (
                                            <SortableItem key={author.id} id={author.id}>
                                                <div className="flex items-center gap-1.5 align-center justify-center">
                                                    <span className="font-medium">
                                                        {author.initials}
                                                    </span>
                                                    {showEnvelope && (
                                                        <Mail className="h-3.5 w-3.5 text-muted-foreground stroke-violet-950 text-violet-950" />
                                                    )}
                                                </div>
                                            </SortableItem>
                                        )
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {!minTimeMet ? (
                            <p className="text-xs text-muted-foreground">Wait at least 10 seconds before continuing.</p>
                        ) : null}
                        <Button onClick={() => void requestAdvance()} disabled={!minTimeMet}>
                            {currentIndex < totalWorks - 1 ? "Next Work" : "Complete"}
                        </Button>
                    </div>
                </>
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

