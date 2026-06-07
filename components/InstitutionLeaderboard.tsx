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

/** Shared column layout for header and every row. */
const ROW_GRID =
    "grid grid-cols-[2.75rem_minmax(0,1fr)_5.75rem] items-center gap-x-3"

function LeaderboardRowContent({ entry }: { entry: InstitutionLeaderboardEntry }) {
    return (
        <>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {entry.rank}
            </span>
            <span className="min-w-0 truncate text-sm text-foreground" title={entry.institutionName}>
                {entry.institutionName}
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                {formatPercent(entry.averageAccuracy)}
            </span>
        </>
    )
}

function HighlightedRow({ entry }: { entry: InstitutionLeaderboardEntry }) {
    return (
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
            <div className={ROW_GRID}>
                <LeaderboardRowContent entry={entry} />
            </div>
        </div>
    )
}

function LeaderboardListItem({
    entry,
    highlight,
    showDividerBelow,
}: {
    entry: InstitutionLeaderboardEntry
    highlight?: boolean
    showDividerBelow?: boolean
}) {
    if (highlight) {
        return (
            <li className="py-0">
                <HighlightedRow entry={entry} />
            </li>
        )
    }

    return (
        <li
            className={cn(
                "px-3 py-2.5",
                showDividerBelow && "border-b border-border"
            )}
        >
            <div className={ROW_GRID}>
                <LeaderboardRowContent entry={entry} />
            </div>
        </li>
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
                    <div className="min-w-[16rem]">
                        <div className="border-b border-border px-3 pb-2.5 mb-0.5">
                            <div
                                className={cn(
                                    ROW_GRID,
                                    "text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                )}
                            >
                                <span>Rank</span>
                                <span>Institution</span>
                                <span className="text-right whitespace-nowrap">Avg. accuracy</span>
                            </div>
                        </div>

                        <ul className="m-0 list-none p-0">
                            {top10.map((entry, index) => {
                                const highlight =
                                    !respondent &&
                                    highlightInstitutionKey === entry.institutionKey
                                const nextEntry = top10[index + 1]
                                const nextIsHighlight =
                                    !respondent &&
                                    nextEntry &&
                                    highlightInstitutionKey === nextEntry.institutionKey

                                return (
                                    <LeaderboardListItem
                                        key={entry.institutionKey}
                                        entry={entry}
                                        highlight={highlight}
                                        showDividerBelow={
                                            index < top10.length - 1 &&
                                            !highlight &&
                                            !nextIsHighlight
                                        }
                                    />
                                )
                            })}
                        </ul>

                        {respondent ? (
                            <div className="mt-4 border-t border-border pt-4">
                                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Your institution
                                </p>
                                <div className="px-0">
                                    <HighlightedRow entry={respondent} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </FadeIn>
    )
}
