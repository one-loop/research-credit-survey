"use client"

import { DndContext, closestCenter } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState, useEffect, Suspense, Fragment } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mail } from "lucide-react"
import type { Work, Author } from "@/lib/types"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

const roleDetailsMap: Record<string, { verb: string; description: string }> = {
    "Conceptualization": {
        verb: "conceived the study",
        description: "Ideas, formulation or evolution of overarching research goals and aims.",
    },
    "Methodology": {
        verb: "designed the methodology",
        description: "Development or design of methodology; creation of models.",
    },
    "Software": {
        verb: "developed the software",
        description: "Programming, software development, and implementation of code and supporting algorithms.",
    },
    "Validation": {
        verb: "validated the results",
        description: "Verification and reproducibility of results, experiments, or outputs.",
    },
    "Formal Analysis": {
        verb: "conducted the analysis",
        description: "Application of statistical, mathematical, computational, or other formal techniques to analyze data.",
    },
    "Formal analysis": {
        verb: "conducted the analysis",
        description: "Application of statistical, mathematical, computational, or other formal techniques to analyze data.",
    },
    "Investigation": {
        verb: "performed the investigation",
        description: "Conducting experiments or data/evidence collection.",
    },
    "Resources": {
        verb: "provided resources",
        description: "Provision of study materials, samples, instrumentation, computing resources, or other tools.",
    },
    "Data curation": {
        verb: "processed the data",
        description: "Management activities to annotate, clean, and maintain research data for initial use and later reuse.",
    },
    "Writing – original draft": {
        verb: "wrote the manuscript",
        description: "Preparation, creation, and/or presentation of the published work in the initial draft form.",
    },
    "Writing – review & editing": {
        verb: "reviewed and edited the manuscript",
        description: "Critical review, commentary, or revision of the manuscript at any stage, including pre- or post-publication.",
    },
    "Visualization": {
        verb: "created the visualizations",
        description: "Preparation and creation of visual representations and data presentations.",
    },
    "Supervision": {
        verb: "supervised the study",
        description: "Oversight and leadership responsibility for planning and execution, including mentorship external to the core team.",
    },
    "Project administration": {
        verb: "administered the project",
        description: "Management and coordination responsibility for planning and executing the research activity.",
    },
    "Funding acquisition": {
        verb: "acquired funding",
        description: "Acquisition of financial support for the project leading to this publication.",
    },
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

function ExperimentAPageContent() {
    const searchParams = useSearchParams()
    const authorId = searchParams.get("authorId") ?? undefined

    const [works, setWorks] = useState<Work[] | null>(null)
    const [dataSource, setDataSource] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [trialResults, setTrialResults] = useState<string[][]>([])
    const [items, setItems] = useState<Author[]>([])
    const [submitDone, setSubmitDone] = useState(false)
    const [showIntro, setShowIntro] = useState(true)

    const authorColors = ["text-red-600", "text-blue-600", "text-green-600", "text-amber-600"]

    useEffect(() => {
        const params = new URLSearchParams()
        if (authorId) params.set("authorId", authorId)

        setLoading(true)
        setError(null)

        const keyAuthor = authorId ?? "none"
        const storageKey = `experimentWorks_${keyAuthor}`
        const legacyStorageKey = `experimentA_works_${keyAuthor}`

        let usedPrefetch = false

        if (typeof window !== "undefined") {
            const stored =
                window.sessionStorage.getItem(storageKey) ??
                window.sessionStorage.getItem(legacyStorageKey)
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
                        setItems([...shuffled[0].authors])
                    }
                    setError(null)
                    setLoading(false)
                    usedPrefetch = true
                } catch (err) {
                    console.error("[experiment-a] failed to parse prefetched works from sessionStorage:", err)
                }
            }
        }

        if (usedPrefetch) return

        fetch(`/api/survey/works?${params.toString()}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load works")
                return res.json()
            })
            .then((data: { works: Work[]; dataSource?: string }) => {
                const incoming = data.works ?? []
                if (data.dataSource) setDataSource(data.dataSource)
                // Randomize order of the 5 selected works so the respondent's
                // own work is not always shown first.
                const shuffled = [...incoming]
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
                }

                setWorks(shuffled)
                if (shuffled.length > 0) {
                    setItems([...shuffled[0].authors])
                }
                setError(null)
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
            .finally(() => setLoading(false))
    }, [authorId])

    const totalWorks = works?.length ?? 0
    const isComplete = totalWorks > 0 && currentIndex >= totalWorks
    const currentWork = works && totalWorks > 0 ? works[currentIndex] : null

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

    async function handleNext() {
        if (!works) return
        const ranking = items.map((i) => i.id)
        const newResults = [...trialResults, ranking]

        if (currentIndex < totalWorks - 1) {
            setTrialResults(newResults)
            setCurrentIndex(currentIndex + 1)
            setItems([...works[currentIndex + 1].authors])
        } else {
            setTrialResults(newResults)
            setCurrentIndex(totalWorks)

            const workIds = works.map((w) => w.work_id)
            const rankings: Record<string, string[]> = {}
            works.forEach((w, i) => {
                rankings[w.work_id] = newResults[i] ?? []
            })

            let roleImportance: Record<string, number> | undefined
            if (typeof window !== "undefined" && authorId) {
                const storageKey = `roleImportance_${authorId}`
                const stored = window.sessionStorage.getItem(storageKey)
                if (stored) {
                    try {
                        roleImportance = JSON.parse(stored) as Record<string, number>
                    } catch (err) {
                        console.error("[experiment-a] failed to parse roleImportance from sessionStorage:", err)
                    }
                }
            }

            try {
                await fetch("/api/survey/complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        workIds,
                        rankings,
                        authorId,
                        roleImportance,
                        experimentType: "A",
                    })
                })
                setSubmitDone(true)
            } catch {
                setError("Failed to submit rankings")
            }
        }
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
                <h1 className="text-2xl font-bold mb-4">Experiment A</h1>
                <p className="text-destructive">
                    {error ?? "No works available. Try again later."}
                </p>
            </div>
        )
    }

    if (isComplete && submitDone) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Experiment A Complete</h1>
                <p className="mb-6 text-muted-foreground">
                    Thank you for completing all {totalWorks} works!
                </p>
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Your Rankings</h2>
                    {trialResults.map((ranking, index) => {
                        const work = works?.[index]
                        if (!work) return null
                        return (
                            <div key={work.work_id} className="border rounded p-4">
                                <h3 className="font-medium mb-2">Work {index + 1}</h3>
                                <ol className="list-decimal list-inside space-y-1">
                                    {ranking.map((authorId, rank) => (
                                        <li key={authorId} className="text-sm">
                                            {work.authors.find((a) => a.id === authorId)?.initials} (Rank {rank + 1})
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    if (isComplete && !submitDone) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Submitting your responses…</p>
            </div>
        )
    }

    if (showIntro && !isComplete) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Before You Begin</h1>
                <p className="text-muted-foreground mb-3 leading-relaxed">
                    You are about to see a sample of <span className="font-semibold text-black">5 papers</span> from your field within a journal
                    that we understand you have a history of publishing in.
                </p>
                <p className="text-muted-foreground mb-3 leading-relaxed">
                    The papers are <span className="font-semibold text-black">anonymized</span> and the authors are represented by their <span className="font-semibold text-black">initials</span>.
                </p>
                <p className="text-muted-foreground mb-3 leading-relaxed">
                    For each paper, you will be given a list of anonymized authors and their <span className="font-semibold text-black">individual contributions</span>. 
                </p>
                <p className="text-muted-foreground mb-3 leading-relaxed">
                    You will then be asked to <span className="font-semibold text-black">order the author positions</span> in the paper's byline from highest to lowest according to how you believe the authors contributed to the paper.
                </p>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    We will begin by showing you a <span className="font-semibold text-black">practice trial</span> to familiarize you with the task. Once you are comfortable with the task, we will begin showing you the actual papers.
                </p>
                <div className="flex justify-end">
                    <Button onClick={() => setShowIntro(false)}>Begin Experiment</Button>
                </div>
            </div>
        )
    }

    // Create a color map based on original author order, so colors stay consistent when dragging
    const authorColorMap = currentWork
        ? new Map(
              currentWork.authors.map((a, index) => [
                  a.id,
                  authorColors[index % authorColors.length],
              ])
          )
        : new Map<string, string>()

    // Find the original index of the corresponding author (envelope icon position)
    const correspondingAuthorIndex = currentWork
        ? currentWork.authors.findIndex((a) => a.is_corresponding)
        : -1

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">Author Contribution Ranking</h1>
                <p className="text-muted-foreground">
                    Work {currentIndex + 1} of {totalWorks}
                </p>
                {currentWork?.isOwnWork && (
                    <p className="mt-1 text-xs text-amber-600">
                        [Debug] This work was selected using the provided authorId and is the respondent&apos;s own paper.
                    </p>
                )}
                {dataSource && (
                    <p className={`mt-1 text-xs ${dataSource === "supabase" ? "text-green-600" : "text-muted-foreground"}`}>
                        [Debug] Data source: {dataSource === "supabase" ? "Supabase (papers table)" : "mock data"}.
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
                        <p className="text-lg font-medium mb-0">Author contributions</p>
                        <p className="text-sm text-muted-foreground mb-4">You can hover over a contribution role to see more information about it.</p>
                        <p className="text-lg leading-relaxed text-muted-foreground font-medium">
                            <TooltipProvider>
                            {(() => {
                                // Group authors by contribution role
                                const roleGroups = new Map<string, typeof currentWork.authors>()
                                currentWork.authors.forEach((author) => {
                                    author.contributions.forEach((role) => {
                                        if (!roleGroups.has(role)) {
                                            roleGroups.set(role, [])
                                        }
                                        roleGroups.get(role)!.push(author)
                                    })
                                })

                                // Convert to array and format each group
                                const formattedGroups = Array.from(roleGroups.entries()).map(
                                    ([role, authors]) => {
                                        const roleDetails = roleDetailsMap[role] ?? {
                                            verb: `contributed to ${role}`,
                                            description: role,
                                        }
                                        const authorNames = authors.map((a) => {
                                            const colorClass = authorColorMap.get(a.id)!
                                            return (
                                                <span key={a.id} className={`font-semibold ${colorClass}`}>
                                                    {a.initials}
                                                </span>
                                            )
                                        })

                                        // Format author list with "and" before last
                                        let authorList: React.ReactNode
                                        if (authorNames.length === 1) {
                                            authorList = authorNames[0]
                                        } else if (authorNames.length === 2) {
                                            authorList = (
                                                <>
                                                    {authorNames[0]} and {authorNames[1]}
                                                </>
                                            )
                                        } else {
                                            authorList = (
                                                <>
                                                    {authorNames.slice(0, -1).map((name, i) => (
                                                        <Fragment key={i}>
                                                            {name}
                                                            {i < authorNames.length - 2 ? ", " : ""}
                                                        </Fragment>
                                                    ))}
                                                    , and {authorNames[authorNames.length - 1]}
                                                </>
                                            )
                                        }

                                        return (
                                            <Tooltip key={role}>
                                                <TooltipTrigger asChild>
                                                    <span className="cursor-help decoration-dotted underline-offset-4 hover:underline">
                                                        {authorList} {roleDetails.verb}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent sideOffset={6} className="max-w-sm leading-relaxed">
                                                    <p className="font-semibold">{role}</p>
                                                    <p>{roleDetails.description}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )
                                    }
                                )

                                // Join groups with periods and spaces
                                return formattedGroups.map((group, index) => (
                                    <span key={index}>
                                        {group}
                                        {index < formattedGroups.length - 1 ? ". " : "."}
                                    </span>
                                ))
                            })()}
                            </TooltipProvider>
                        </p>
                    </div>

                    <div className="mb-6">
                        <p className="font-medium mb-6">
                            Please order the author positions for this paper. (left = highest contribution).
                        </p>
                        <p className="mb-12 text-muted-foreground text-sm">
                            <Mail className="h-3.5 w-3.5 inline stroke-violet-950 text-violet-950" /> Your choice of corresponding author once you submit. The position at which the corresponding author occurs is fixed
                        </p>
                        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={items.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
                                <div className="flex flex-row flex-wrap gap-3">
                                    {items.map((author, positionIndex) => {
                                        const colorClass = authorColorMap.get(author.id)!
                                        const showEnvelope = correspondingAuthorIndex >= 0 && positionIndex === correspondingAuthorIndex
                                        return (
                                            <SortableItem key={author.id} id={author.id}>
                                                <div className="flex items-center gap-1.5 align-center justify-center">
                                                    <span className={`font-medium ${colorClass}`}>
                                                        {author.initials}
                                                    </span>
                                                    {showEnvelope && (
                                                        <Mail className="h-3.5 w-3.5 stroke-violet-950 text-violet-950" />
                                                    )}
                                                </div>
                                            </SortableItem>
                                        )
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleNext}>
                            {currentIndex < totalWorks - 1 ? "Next Work" : "Complete"}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}

export default function ExperimentAPage() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        }>
            <ExperimentAPageContent />
        </Suspense>
    )
}
