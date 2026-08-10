import type { ExperimentType } from "@/lib/survey/experimentAssignment"

export type SeenWorkStats = {
    seenByRespondent: boolean
    uniqueRespondents: Set<string>
    totalResponsesCount?: number
    experimentsSeenIn: Set<ExperimentType>
}

export function isInRespondentScope(
    row: { domain?: string | null; journal?: string | null },
    scope: { domain?: string; journal?: string }
): boolean {
    if (scope.domain && row.domain !== scope.domain) return false
    if (scope.journal && row.journal !== scope.journal) return false
    return true
}

export function shouldExcludeBySeenRules(
    row: { work_id: string; work_exposure?: number | null },
    stats: SeenWorkStats | undefined,
    opts: {
        ownWorkId: string | undefined
        experimentType: ExperimentType
    }
): boolean {
    const exposure =
        typeof row.work_exposure === "number" && Number.isFinite(row.work_exposure)
            ? row.work_exposure
            : 0
    const totalSeen = Math.max(
        stats?.totalResponsesCount ?? 0,
        stats?.uniqueRespondents.size ?? 0,
        exposure
    )

    if (stats?.seenByRespondent) return true
    if (totalSeen >= 3) return true
    if (totalSeen >= 2 && row.work_id !== opts.ownWorkId) return true

    if (stats) {
        for (const seenExp of stats.experimentsSeenIn) {
            if (seenExp !== opts.experimentType) return true
        }
    }
    return false
}

