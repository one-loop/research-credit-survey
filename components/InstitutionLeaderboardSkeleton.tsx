import { Skeleton } from "@/components/ui/skeleton"

function LeaderboardRowSkeleton({ nameWidth }: { nameWidth: string }) {
    return (
        <tr>
            <td className="py-2.5 pr-3">
                <Skeleton className="h-4 w-5" />
            </td>
            <td className="py-2.5 pr-3">
                <Skeleton className={`h-4 ${nameWidth}`} />
            </td>
            <td className="py-2.5 text-right">
                <Skeleton className="h-4 w-10 ml-auto" />
            </td>
        </tr>
    )
}

export function InstitutionLeaderboardSkeleton() {
    return (
        <div className="rounded-lg border bg-card p-4" aria-busy="true" aria-label="Loading leaderboard">
            <Skeleton className="h-4 w-44 mb-2" />
            <Skeleton className="h-3 w-full max-w-sm mb-4" />
            <table className="w-full">
                <thead>
                    <tr className="border-b">
                        <th className="pb-2 pr-3">
                            <Skeleton className="h-3 w-8" />
                        </th>
                        <th className="pb-2 pr-3">
                            <Skeleton className="h-3 w-16" />
                        </th>
                        <th className="pb-2 text-right">
                            <Skeleton className="h-3 w-14 ml-auto" />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <LeaderboardRowSkeleton nameWidth="w-40" />
                    <LeaderboardRowSkeleton nameWidth="w-48" />
                    <LeaderboardRowSkeleton nameWidth="w-36" />
                    <LeaderboardRowSkeleton nameWidth="w-44" />
                    <LeaderboardRowSkeleton nameWidth="w-32" />
                </tbody>
            </table>
        </div>
    )
}
