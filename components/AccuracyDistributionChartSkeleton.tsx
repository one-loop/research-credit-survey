import { Skeleton } from "@/components/ui/skeleton"

const BAR_HEIGHTS = [0.45, 0.7, 0.55, 0.9, 0.35, 0.6, 0.5, 0.75, 0.4, 0.65]

export function AccuracyDistributionChartSkeleton() {
    return (
        <div className="rounded-lg border bg-card p-4" aria-busy="true" aria-label="Loading chart">
            <Skeleton className="h-4 w-56 mb-2" />
            <Skeleton className="h-3 w-full max-w-md mb-4" />
            <Skeleton className="h-3 w-4/5 max-w-sm mb-6" />
            <div className="flex items-end gap-1.5 h-[140px] px-1">
                {BAR_HEIGHTS.map((h, i) => (
                    <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h * 100}%` }} />
                ))}
            </div>
            <div className="flex justify-between mt-3 px-1">
                <Skeleton className="h-2 w-6" />
                <Skeleton className="h-2 w-6" />
                <Skeleton className="h-2 w-6" />
            </div>
        </div>
    )
}
