import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const ROW_GRID =
    "grid grid-cols-[2.75rem_minmax(0,1fr)_5.75rem] items-center gap-x-3"

function LeaderboardRowSkeleton({ nameWidth }: { nameWidth: string }) {
    return (
        <li className="border-b border-border px-3 py-2.5 last:border-b-0">
            <div className={ROW_GRID}>
                <Skeleton className="h-4 w-5" />
                <Skeleton className={`h-4 ${nameWidth}`} />
                <Skeleton className="ml-auto h-4 w-10" />
            </div>
        </li>
    )
}

export function InstitutionLeaderboardSkeleton() {
    return (
        <div className="rounded-lg border bg-card p-4" aria-busy="true" aria-label="Loading leaderboard">
            <Skeleton className="h-5 w-44 mb-2" />
            <Skeleton className="h-3 w-full max-w-sm mb-4" />
            <div className="min-w-[16rem]">
                <div className="border-b border-border px-3 pb-2.5 mb-0.5">
                    <div className={cn(ROW_GRID)}>
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="ml-auto h-3 w-14" />
                    </div>
                </div>
                <ul className="m-0 list-none p-0">
                    <LeaderboardRowSkeleton nameWidth="w-40" />
                    <LeaderboardRowSkeleton nameWidth="w-48" />
                    <LeaderboardRowSkeleton nameWidth="w-36" />
                    <LeaderboardRowSkeleton nameWidth="w-44" />
                    <LeaderboardRowSkeleton nameWidth="w-32" />
                </ul>
            </div>
        </div>
    )
}
