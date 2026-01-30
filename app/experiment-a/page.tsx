"use client"

import { experimentATrials } from "@/lib/mockData"
import { DndContext, closestCenter } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState } from "react"
import { Button } from "@/components/ui/button"

function SortableItem({ id, children }: any) {
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

export default function ExperimentAPage() {
    const [currentTrial, setCurrentTrial] = useState(0)
    const [trialResults, setTrialResults] = useState<string[][]>([])
    const [items, setItems] = useState(experimentATrials[0])

    const totalTrials = experimentATrials.length
    const isComplete = currentTrial >= totalTrials

    function handleDragEnd(event: any) {
        const { active, over } = event
        if (!over) {
            return
        }
        if (active.id !== over.id) {
            setItems(items => {
                const oldIndex = items.findIndex(i => i.id === active.id)
                const newIndex = items.findIndex(i => i.id === over.id)
                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }

    function handleNextTrial() {
        // Save current trial result
        const ranking = items.map(i => i.id)
        setTrialResults([...trialResults, ranking])

        // Move to next trial
        if (currentTrial < totalTrials - 1) {
            setCurrentTrial(currentTrial + 1)
            setItems([...experimentATrials[currentTrial + 1]])
        } else {
            setCurrentTrial(totalTrials) // Mark as complete
        }
    }

    if (isComplete) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">
                    Experiment A Complete
                </h1>
                <p className="mb-6 text-muted-foreground">
                    Thank you for completing all {totalTrials} trials!
                </p>
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Your Rankings:</h2>
                    {trialResults.map((ranking, index) => (
                        <div key={index} className="border rounded p-4">
                            <h3 className="font-medium mb-2">Trial {index + 1}:</h3>
                            <ol className="list-decimal list-inside space-y-1">
                                {ranking.map((authorId, rank) => (
                                    <li key={authorId} className="text-sm">
                                        {experimentATrials[index].find(a => a.id === authorId)?.initials} (Rank {rank + 1})
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    const currentAuthors = experimentATrials[currentTrial]

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">
                    Author Ordering Task
                </h1>
                <p className="text-muted-foreground">
                    Trial {currentTrial + 1} of {totalTrials}
                </p>
                <div className="mt-2 w-full bg-secondary rounded-full h-2">
                    <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${((currentTrial + 1) / totalTrials) * 100}%` }}
                    />
                </div>
            </div>

            <div className="mb-6 space-y-3">
                <p className="text-sm font-medium mb-2">Author Contributions:</p>
                {currentAuthors.map(a => (
                    <div key={a.id} className="text-sm border rounded p-2 bg-muted/50">
                        <strong>{a.initials}</strong>: {a.contributions.join(", ")}
                    </div>
                ))}
            </div>

            <div className="mb-6">
                <p className="text-sm font-medium mb-3">
                    Please order the authors from the first to the last as you think they should appear on the byline<br/>(top = highest contribution):
                </p>
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
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
                <Button onClick={handleNextTrial}>
                    {currentTrial < totalTrials - 1 ? "Next Trial" : "Complete"}
                </Button>
            </div>
        </div>
    )
}
