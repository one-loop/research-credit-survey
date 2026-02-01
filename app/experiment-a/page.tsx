"use client"

import { DndContext, closestCenter } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { Work, Author } from "@/lib/types"

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
            className="border rounded p-3 bg-card cursor-grab active:cursor-grabbing"
        >
            {children}
        </div>
    )
}

function ExperimentAPageContent() {
    const searchParams = useSearchParams()
    const authorId = searchParams.get("authorId") ?? undefined

    const [works, setWorks] = useState<Work[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [trialResults, setTrialResults] = useState<string[][]>([])
    const [items, setItems] = useState<Author[]>([])
    const [submitDone, setSubmitDone] = useState(false)

    useEffect(() => {
        const params = new URLSearchParams()
        if (authorId) params.set("authorId", authorId)
        fetch(`/api/survey/works?${params.toString()}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load works")
                return res.json()
            })
            .then((data: { works: Work[] }) => {
                setWorks(data.works ?? [])
                if (data.works?.length > 0) {
                    setItems([...data.works[0].authors])
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
            try {
                await fetch("/api/survey/complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workIds, rankings })
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
                        const work = works[index]
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

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">Author Contribution Ranking</h1>
                <p className="text-muted-foreground">
                    Work {currentIndex + 1} of {totalWorks}
                </p>
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
                        <p className="text-sm font-medium mb-2">Author contributions</p>
                        {currentWork.authors.map((a) => (
                            <div key={a.id} className="text-sm border rounded p-2 bg-muted/50">
                                <strong>{a.initials}</strong>: {a.contributions.join(", ")}
                            </div>
                        ))}
                    </div>

                    <div className="mb-6">
                        <p className="text-sm font-medium mb-3">
                            Please order the authors from first to last as they should appear on the byline (top = highest contribution).
                        </p>
                        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-3">
                                    {items.map((author, index) => (
                                        <SortableItem key={author.id} id={author.id}>
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{author.initials}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    Rank {index + 1}
                                                </span>
                                            </div>
                                        </SortableItem>
                                    ))}
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
