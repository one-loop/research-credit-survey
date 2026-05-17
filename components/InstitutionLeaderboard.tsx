"use client"

import type { InstitutionLeaderboardEntry } from "@/lib/survey/institutionLeaderboard"

type Props = {
    top10: InstitutionLeaderboardEntry[]
    respondent: InstitutionLeaderboardEntry | null
    highlightInstitutionKey?: string | null
}

function formatPercent(accuracy: number): string {
    return `${Math.round(accuracy * 100)}%`
}

function LeaderboardRow({
    entry,
    highlight,
}: {
    entry: InstitutionLeaderboardEntry
    highlight?: boolean
}) {
    return (
        <tr className={highlight ? "bg-violet-50" : undefined}>
            <td className="py-2 pr-3 text-sm font-medium tabular-nums w-10">{entry.rank}</td>
            <td className="py-2 pr-3 text-sm">{entry.institutionName}</td>
            <td className="py-2 text-sm text-right font-semibold tabular-nums">
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
        <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-1">Institution leaderboard</h2>
            <p className="text-xs text-muted-foreground mb-4">
                Average block accuracy by institution (participants who listed their current
                institution).
            </p>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="pb-2 pr-3 font-medium">Rank</th>
                            <th className="pb-2 pr-3 font-medium">Institution</th>
                            <th className="pb-2 font-medium text-right">Avg. accuracy</th>
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
                    <p className="text-xs text-muted-foreground mb-2">Your institution</p>
                    <table className="w-full">
                        <tbody>
                            <LeaderboardRow entry={respondent} highlight />
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    )
}
