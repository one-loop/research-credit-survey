import { Skeleton } from "@/components/ui/skeleton"

export function AccuracyDistributionChartSkeleton() {
    return (
        <div className="rounded-lg border bg-card p-4" aria-busy="true" aria-label="Loading chart">
            <Skeleton className="h-5 w-56 mb-2" />
            <Skeleton className="h-3 w-full max-w-md mb-4" />
            <Skeleton className="h-3 w-4/5 max-w-sm mb-6" />
            <div className="relative h-[160px] px-2">
                <svg
                    viewBox="0 0 360 160"
                    className="h-full w-full max-w-md text-muted-foreground/30"
                    aria-hidden
                >
                    <path
                        d="M 8,140 L 8,140 L 60,130 L 120,95 L 180,60 L 240,35 L 300,18 L 352,8 L 352,140 L 8,140 Z"
                        className="fill-current opacity-40"
                    />
                    <path
                        d="M 8,140 L 60,130 L 120,95 L 180,60 L 240,35 L 300,18 L 352,8"
                        fill="none"
                        className="stroke-current"
                        strokeWidth={2}
                    />
                </svg>
            </div>
            <div className="flex justify-between mt-2 px-1">
                <Skeleton className="h-2 w-16" />
                <Skeleton className="h-2 w-6" />
                <Skeleton className="h-2 w-6" />
                <Skeleton className="h-2 w-6" />
            </div>
        </div>
    )
}
