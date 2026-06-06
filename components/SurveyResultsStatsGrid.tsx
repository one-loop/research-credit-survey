"use client"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export type SurveyStatCard = {
    id: string
    label: string
    value: string
    description?: string
}

type Props = {
    stats: SurveyStatCard[]
    /** Placeholder cells while accuracy or percentile data is still loading. */
    skeletonCount?: number
}

function StatCard({ label, value, description }: Omit<SurveyStatCard, "id">) {
    return (
        <div className="flex min-h-[5.75rem] flex-col justify-between rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">
                {value}
            </p>
            {description ? (
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{description}</p>
            ) : null}
        </div>
    )
}

function StatCardSkeleton() {
    return (
        <div
            className="flex min-h-[5.75rem] flex-col justify-between rounded-lg border bg-card p-4"
            aria-hidden
        >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-28" />
        </div>
    )
}

export function SurveyResultsStatsGrid({ stats, skeletonCount = 0 }: Props) {
    const totalCells = stats.length + skeletonCount
    if (totalCells === 0) return null

    return (
        <div
            className={cn(
                "grid gap-3",
                totalCells === 1 ? "grid-cols-1" : "grid-cols-2"
            )}
            aria-busy={skeletonCount > 0 || undefined}
        >
            {stats.map(({ id, ...stat }) => (
                <StatCard key={id} {...stat} />
            ))}
            {Array.from({ length: skeletonCount }).map((_, index) => (
                <StatCardSkeleton key={`skeleton-${index}`} />
            ))}
        </div>
    )
}
