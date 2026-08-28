"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
    CREDIT_ROLE_ROWS,
    authorHasCreditRole,
} from "@/lib/survey/creditRoleMatching"
import type { Author } from "@/lib/types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowRightLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
    authors: Author[]
    getAuthorLabel?: (author: Author) => string
    className?: string
}

export function AuthorContributionsMatrix({
    authors,
    getAuthorLabel = (author) => author.initials,
    className,
}: Props) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)
    const [hasOverflow, setHasOverflow] = useState(false)

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        const { scrollLeft, scrollWidth, clientWidth } = el
        const overflow = scrollWidth > clientWidth + 2
        setHasOverflow(overflow)
        setCanScrollLeft(scrollLeft > 2)
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2)
    }, [])

    useEffect(() => {
        updateScrollState()
        const el = scrollRef.current
        if (!el) return

        el.addEventListener("scroll", updateScrollState, { passive: true })
        const resizeObserver = new ResizeObserver(() => updateScrollState())
        resizeObserver.observe(el)

        return () => {
            el.removeEventListener("scroll", updateScrollState)
            resizeObserver.disconnect()
        }
    }, [updateScrollState, authors])

    const scrollContainer = (direction: "left" | "right") => {
        const el = scrollRef.current
        if (!el) return
        const step = direction === "left" ? -180 : 180
        el.scrollBy({ left: step, behavior: "smooth" })
    }

    if (authors.length === 0) return null

    return (
        <TooltipProvider>
            <div className={cn("w-full max-w-full flex flex-col items-center", className)}>
                {/* Scroll affordance header bar (shown when table overflows horizontally) */}
                {hasOverflow && (
                    <div className="w-full mb-1.5 flex items-center justify-between gap-2 px-1 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-violet-950 dark:text-violet-200">
                            <ArrowRightLeft className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                            <span>
                                Scroll horizontally to view all {authors.length} authors
                            </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => scrollContainer("left")}
                                disabled={!canScrollLeft}
                                title="Scroll left"
                                aria-label="Scroll table left"
                                className="inline-flex h-6 w-6 items-center justify-center rounded border border-violet-200 bg-background text-foreground shadow-xs transition-colors hover:bg-violet-50 disabled:opacity-30 disabled:pointer-events-none dark:border-violet-800"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => scrollContainer("right")}
                                disabled={!canScrollRight}
                                title="Scroll right"
                                aria-label="Scroll table right"
                                className="inline-flex h-6 w-6 items-center justify-center rounded border border-violet-200 bg-background text-foreground shadow-xs transition-colors hover:bg-violet-50 disabled:opacity-30 disabled:pointer-events-none dark:border-violet-800"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Table wrapper with edge gradient shadow overlays */}
                <div className="relative max-w-full">
                    {/* Left shadow fade */}
                    {hasOverflow && (
                        <div
                            className={cn(
                                "pointer-events-none absolute inset-y-0 left-0 w-8 z-25 bg-gradient-to-r from-violet-950/20 via-violet-950/5 to-transparent rounded-l-lg transition-opacity duration-200",
                                canScrollLeft ? "opacity-100" : "opacity-0"
                            )}
                        />
                    )}

                    {/* Right shadow fade */}
                    {hasOverflow && (
                        <div
                            className={cn(
                                "pointer-events-none absolute inset-y-0 right-0 w-8 z-25 bg-gradient-to-l from-violet-950/20 via-violet-950/5 to-transparent rounded-r-lg transition-opacity duration-200",
                                canScrollRight ? "opacity-100" : "opacity-0"
                            )}
                        />
                    )}

                    <div
                        ref={scrollRef}
                        className="max-w-full overflow-x-auto rounded-lg border border-violet-950 bg-card shadow-sm"
                    >
                        <table className="w-auto border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-violet-200 bg-violet-50 text-violet-950">
                                    <th
                                        scope="col"
                                        className="sticky left-0 z-20 border-r border-violet-200 bg-violet-50 px-3 py-2.5 text-right font-semibold"
                                    >
                                        Role
                                    </th>
                                    {authors.map((author) => {
                                        const label = getAuthorLabel(author)
                                        return (
                                            <th
                                                key={`head-${author.id}`}
                                                scope="col"
                                                className="px-2.5 py-2.5 text-center font-semibold leading-snug whitespace-nowrap min-w-[3.25rem]"
                                            >
                                                {label}
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {CREDIT_ROLE_ROWS.map((role, rowIndex) => (
                                    <tr
                                        key={role.id}
                                        className={rowIndex % 2 === 0 ? "bg-background" : "bg-violet-50/50"}
                                    >
                                        <th
                                            scope="row"
                                            className={cn(
                                                "sticky left-0 z-10 border-r border-violet-200 px-3 py-1.5 text-right font-normal text-muted-foreground whitespace-nowrap",
                                                rowIndex % 2 === 0 ? "bg-background" : "bg-violet-50/50"
                                            )}
                                        >
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="cursor-help underline decoration-dotted underline-offset-2">
                                                        {role.name}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="left" sideOffset={6} className="max-w-xs leading-relaxed">
                                                    <p>{role.description}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </th>

                                        {authors.map((author) => {
                                            const active = authorHasCreditRole(author.contributions, role.name)
                                            const label = getAuthorLabel(author)
                                            return (
                                                <td
                                                    key={`${role.id}-${author.id}`}
                                                    className="px-2.5 py-1.5 text-center min-w-[3.25rem]"
                                                    aria-label={`${label} — ${role.name}: ${active ? "yes" : "no"}`}
                                                    title={`${label} · ${role.name}`}
                                                >
                                                    <span
                                                        className={cn(
                                                            "mx-auto block h-3.5 w-3.5 rounded-sm border",
                                                            active
                                                                ? "border-violet-900 bg-violet-800"
                                                                : "border-violet-200/80 bg-muted/60"
                                                        )}
                                                    />
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}
