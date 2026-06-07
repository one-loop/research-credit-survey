"use client"

import type { InstitutionLeaderboardEntry } from "@/lib/survey/institutionLeaderboard"
import { FadeIn } from "@/components/SurveyMotion"
import { cn } from "@/lib/utils"

type Props = {
    top10: InstitutionLeaderboardEntry[]
    respondent: InstitutionLeaderboardEntry | null
    highlightInstitutionKey?: string | null
}

function formatPercent(accuracy: number): string {
    return `${Math.round(accuracy * 100)}%`
}

const ROW_GRID = "grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-2"

function LeaderboardRowCells({ entry }: { entry: InstitutionLeaderboardEntry }) {
    return (
        <>
            <span className="text-sm font-medium tabular-nums">{entry.rank}</span>
            <span className="text-sm truncate">{entry.institutionName}</span>
            <span className="text-sm text-right font-semibold tabular-nums">
                {formatPercent(entry.averageAccuracy)}
            </span>
        </>
    )
}

function LeaderboardRow({
    entry,
    highlight,
}: {
    entry: InstitutionLeaderboardEntry
    highlight?: boolean
}) {
    if (highlight) {
        return (
            <tr>
                <td colSpan={3} className="py-0.5 px-0">
                    <div
                        className={cn(
                            ROW_GRID,
                            "rounded-md bg-violet-50 px-3 py-2",
                            "ring-1 ring-inset ring-violet-200/70"
                        )}
                    >
                        <LeaderboardRowCells entry={entry} />
                    </div>
                </td>
            </tr>
        )
    }

    return (
        <tr className="border-b border-border/60 last:border-b-0">
            <td className="py-2 px-3 text-sm font-medium tabular-nums w-10">{entry.rank}</td>
            <td className="py-2 pr-3 text-sm">{entry.institutionName}</td>
            <td className="py-2 px-3 text-sm text-right font-semibold tabular-nums">
                {formatPercent(entry.averageAccuracy)}
            </td>
        </tr>
    )
}

export function InstitutionLeaderboard({
    top10,
    respondent,
    highlightInstitutionKey,
}: Props) {
    if (top10.length === 0 && !respondent) return null

    return (
        <FadeIn delay={120}>
            <div className="rounded-lg border bg-card p-4">
                <h2 className="text-base font-semibold mb-1.5">Institution leaderboard</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Average block accuracy by institution (participants who listed their current
                    institution).
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                                <th className="pb-2 pr-3 font-medium w-10">Rank</th>
                                <th className="pb-2 pr-3 font-medium">Institution</th>
                                <th className="pb-2 font-medium text-right w-[4.5rem]">
                                    Avg. accuracy
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {top10.map((entry) => (
                                <LeaderboardRow
                                    key={entry.institutionKey}
                                    entry={entry}
                                    highlight={
                                        !respondent &&
                                        highlightInstitutionKey === entry.institutionKey
                                    }
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
                {respondent ? (
                    <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                            Your institution
                        </p>
                        <table className="w-full">
                            <tbody>
                                <LeaderboardRow entry={respondent} highlight />
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </div>
        </FadeIn>
    )
}
