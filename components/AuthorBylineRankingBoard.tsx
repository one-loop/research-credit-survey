"use client"

import {
    DndContext,
    PointerSensor,
    TouchSensor,
    closestCorners,
    pointerWithin,
    rectIntersection,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragCancelEvent,
    type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Mail } from "lucide-react"
import {
    forwardRef,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    type CSSProperties,
    type HTMLAttributes,
    type ReactNode,
} from "react"
import type { Author } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
    boardReducer,
    createInitialBoardState,
    isSlotId,
    slotIndexFromId,
} from "@/lib/survey/authorBylineBoardState"

type Props = {
    authors: Author[]
    envelopeSlotIndex: number
    renderAuthorLabel: (author: Author) => ReactNode
    onRankingChange: (ranking: Author[], poolOrderKey: string) => void
    onEnvelopeSlotAuthorChange?: (authorId: string | null) => void
    cardMinWidthCh?: number
    className?: string
}

function authorDragId(authorId: string) {
    return `author:${authorId}`
}

function parseAuthorDragId(id: string): string | null {
    return id.startsWith("author:") ? id.slice("author:".length) : null
}

/** Prefer slot targets under the pointer, then pool, then any intersection. */
const rankingCollisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args)
    if (pointerHits.length > 0) {
        const slotHits = pointerHits.filter((hit) => isSlotId(hit.id))
        if (slotHits.length > 0) return slotHits

        const poolHits = pointerHits.filter((hit) => hit.id === "pool")
        if (poolHits.length > 0) return poolHits

        return pointerHits
    }

    const intersectionHits = rectIntersection(args)
    if (intersectionHits.length > 0) {
        const slotHits = intersectionHits.filter((hit) => isSlotId(hit.id))
        if (slotHits.length > 0) return slotHits
        return intersectionHits
    }

    return closestCorners(args)
}

const AuthorChip = forwardRef<
    HTMLDivElement,
    {
        author: Author
        renderAuthorLabel: (author: Author) => ReactNode
        cardMinWidthCh?: number
        className?: string
        style?: CSSProperties
    } & Omit<HTMLAttributes<HTMLDivElement>, "children" | "style" | "className">
>(function AuthorChip({ author, renderAuthorLabel, cardMinWidthCh, className, style, ...rest }, ref) {
    return (
        <div
            ref={ref}
            style={{
                minWidth: cardMinWidthCh ? `${cardMinWidthCh}ch` : undefined,
                width: "max-content",
                maxWidth: "100%",
                ...style,
            }}
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-violet-900 bg-violet-100 px-4 py-2.5 text-violet-950",
                "border-b-[5px] font-semibold",
                "transition-[border-width,background-color,margin] duration-100",
                "touch-none select-none",
                className
            )}
            {...rest}
        >
            <span className="whitespace-nowrap">{renderAuthorLabel(author)}</span>
        </div>
    )
})

function DraggableAuthorChip({
    author,
    renderAuthorLabel,
    cardMinWidthCh,
}: {
    author: Author
    renderAuthorLabel: (author: Author) => ReactNode
    cardMinWidthCh?: number
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: authorDragId(author.id),
        data: { authorId: author.id },
    })

    return (
        <AuthorChip
            ref={setNodeRef}
            author={author}
            renderAuthorLabel={renderAuthorLabel}
            cardMinWidthCh={cardMinWidthCh}
            style={{
                transform: CSS.Translate.toString(transform),
                zIndex: isDragging ? 50 : undefined,
            }}
            className={cn(
                "relative cursor-grab active:cursor-grabbing",
                "active:mt-[3px] active:border-b-2",
                isDragging && "mt-[3px] border-b-2 bg-violet-200"
            )}
            {...attributes}
            {...listeners}
        />
    )
}

function PoolDropZone({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    const { setNodeRef, isOver } = useDroppable({ id: "pool" })

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "relative flex min-h-[3.25rem] flex-wrap justify-center gap-3 overflow-visible rounded-lg border border-violet-200/80 bg-violet-50/30 p-3",
                isOver && "border-violet-500 bg-violet-50/60",
                className
            )}
        >
            {children}
        </div>
    )
}

function RankingSlot({
    slotIndex,
    author,
    showEnvelope,
    renderAuthorLabel,
    cardMinWidthCh,
}: {
    slotIndex: number
    author: Author | null
    showEnvelope: boolean
    renderAuthorLabel: (author: Author) => ReactNode
    cardMinWidthCh?: number
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `slot:${slotIndex}` })

    return (
        <div
            className={cn(
                "relative flex min-h-[3.25rem] min-w-[6.5rem] flex-1 items-center overflow-visible rounded-lg border-2 border-dashed px-2 py-2 transition-colors",
                author ? "border-violet-950 bg-violet-50/40" : "border-violet-300/90 bg-background",
                isOver && "border-violet-600 bg-violet-50/70"
            )}
            style={{ minWidth: cardMinWidthCh ? `${Math.max(cardMinWidthCh + 4, 6.5)}ch` : undefined }}
        >
            <div ref={setNodeRef} className="absolute inset-0 z-0 rounded-lg" aria-hidden />
            <div
                className={cn(
                    "relative z-10 flex w-full items-center gap-2",
                    showEnvelope ? "justify-between" : "justify-center"
                )}
            >
                {author ? (
                    <DraggableAuthorChip
                        author={author}
                        renderAuthorLabel={renderAuthorLabel}
                        cardMinWidthCh={cardMinWidthCh}
                    />
                ) : (
                    <span className="text-xs text-muted-foreground/70">Drop here</span>
                )}
                {showEnvelope ? (
                    <Mail
                        className="h-4 w-4 shrink-0 stroke-violet-950 text-violet-950"
                        aria-label="Corresponding author position"
                    />
                ) : author ? (
                    <span className="w-4 shrink-0" aria-hidden />
                ) : null}
            </div>
        </div>
    )
}

export function AuthorBylineRankingBoard({
    authors,
    envelopeSlotIndex,
    renderAuthorLabel,
    onRankingChange,
    onEnvelopeSlotAuthorChange,
    cardMinWidthCh,
    className,
}: Props) {
    const authorIdsKey = useMemo(() => authors.map((author) => author.id).join("\0"), [authors])
    const [state, dispatch] = useReducer(boardReducer, authors, createInitialBoardState)
    const { pool, slots, poolOrderKey } = state
    const seenAuthorIdsKey = useRef(authorIdsKey)

    useEffect(() => {
        if (seenAuthorIdsKey.current === authorIdsKey) return
        seenAuthorIdsKey.current = authorIdsKey
        dispatch({ type: "reset", authors })
    }, [authorIdsKey, authors])

    useEffect(() => {
        const ranking = slots.filter((author): author is Author => author !== null)
        onRankingChange(ranking, poolOrderKey)
        if (onEnvelopeSlotAuthorChange && envelopeSlotIndex >= 0) {
            onEnvelopeSlotAuthorChange(slots[envelopeSlotIndex]?.id ?? null)
        }
    }, [slots, poolOrderKey, onRankingChange, onEnvelopeSlotAuthorChange, envelopeSlotIndex])

    const authorById = useMemo(() => new Map(authors.map((author) => [author.id, author])), [authors])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
    )

    const resolveDropTarget = useCallback((overId: string | null | undefined) => {
        if (!overId) return null
        if (overId === "pool") return { type: "pool" as const }
        if (isSlotId(overId)) {
            const targetSlot = slotIndexFromId(overId)
            if (targetSlot >= 0 && targetSlot < slots.length) {
                return { type: "slot" as const, targetSlot }
            }
        }
        return null
    }, [slots.length])

    const findAuthorLocation = useCallback(
        (authorId: string) => {
            if (pool.some((author) => author.id === authorId)) {
                return { source: "pool" as const }
            }
            const slotIndex = slots.findIndex((author) => author?.id === authorId)
            if (slotIndex >= 0) {
                return { source: "slot" as const, slotIndex }
            }
            return { source: "pool" as const }
        },
        [pool, slots]
    )

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event
            const authorId = parseAuthorDragId(String(active.id))
            if (!authorId || !authorById.has(authorId)) return

            const target = resolveDropTarget(over ? String(over.id) : null)
            if (!target) return

            const from = findAuthorLocation(authorId)

            if (target.type === "pool") {
                if (from.source !== "slot" || from.slotIndex === undefined) return
                dispatch({ type: "slot_to_pool", slotIndex: from.slotIndex })
                return
            }

            if (from.source === "pool") {
                dispatch({ type: "pool_to_slot", authorId, targetSlot: target.targetSlot })
                return
            }

            if (from.source === "slot" && from.slotIndex !== undefined) {
                dispatch({
                    type: "slot_to_slot",
                    fromSlot: from.slotIndex,
                    targetSlot: target.targetSlot,
                })
            }
        },
        [authorById, findAuthorLocation, resolveDropTarget]
    )

    const handleDragCancel = useCallback((_event: DragCancelEvent) => {
        // No-op: transform resets automatically when drag ends.
    }, [])

    return (
        <DndContext
            collisionDetection={rankingCollisionDetection}
            sensors={sensors}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className={cn("space-y-4", className)}>
                <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Authors
                    </p>
                    <PoolDropZone>
                        {pool.length === 0 ? (
                            <span className="text-xs text-muted-foreground">All authors placed</span>
                        ) : (
                            pool.map((author) => (
                                <DraggableAuthorChip
                                    key={author.id}
                                    author={author}
                                    renderAuthorLabel={renderAuthorLabel}
                                    cardMinWidthCh={cardMinWidthCh}
                                />
                            ))
                        )}
                    </PoolDropZone>
                </div>

                <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Byline order
                    </p>
                    <div className="overflow-visible rounded-lg border-2 border-violet-950 bg-card p-3 shadow-sm">
                        <div className="flex flex-wrap gap-3 overflow-visible">
                            {slots.map((author, slotIndex) => (
                                <RankingSlot
                                    key={slotIndex}
                                    slotIndex={slotIndex}
                                    author={author}
                                    showEnvelope={envelopeSlotIndex >= 0 && slotIndex === envelopeSlotIndex}
                                    renderAuthorLabel={renderAuthorLabel}
                                    cardMinWidthCh={cardMinWidthCh}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </DndContext>
    )
}
