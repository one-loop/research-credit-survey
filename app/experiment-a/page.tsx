"use client"

import { experimentAAuthors } from "@/lib/mockData"
import { DndContext, closestCenter } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState } from "react"


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
            className="border rounded p-3 bg-white cursor-grab"
            >
            {children}
        </div>
    )
}

export default function ExperimentAPage() {
    const [items, setItems] = useState(experimentAAuthors)

    function handleDragEnd(event: any) {
        const { active, over } = event
        if (active.id !== over.id) {
            setItems(items => {
                const oldIndex = items.findIndex(i => i.id === active.id)
                const newIndex = items.findIndex(i => i.id === over.id)
                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">
                Author Ordering Task
            </h1>

            <div className="mb-6 space-y-3">
                {experimentAAuthors.map(a => (
                    <div key={a.id} className="text-sm">
                        <strong>{a.initials}</strong>: {a.contributions.join(", ")}
                    </div> 
                ))}
            </div>

            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                        {items.map(author => (
                            <SortableItem key={author.id} id={author.id}>
                                {author.initials}
                            </SortableItem>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            <pre className="mt-6 text-sm bg-gray-100 p-3">
                {JSON.stringify(items.map(i => i.id), null, 2)}
            </pre>
        </div>
    )
}
