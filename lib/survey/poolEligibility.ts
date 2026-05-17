import type { ExperimentType } from "@/lib/survey/experimentAssignment"

export type SeenWorkStats = {
    seenByRespondent: boolean
    uniqueRespondents: Set<string>
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
    row: { work_id: string },
    stats: SeenWorkStats | undefined,
    opts: {
        ownWorkId: string | undefined
        experimentType: ExperimentType
    }
): boolean {
    if (!stats) return false
    if (stats.seenByRespondent) return true
    if (stats.uniqueRespondents.size >= 3) return true
    if (stats.uniqueRespondents.size >= 2 && row.work_id !== opts.ownWorkId) return true
    for (const seenExp of stats.experimentsSeenIn) {
        if (seenExp !== opts.experimentType) return true
    }
    return false
}

