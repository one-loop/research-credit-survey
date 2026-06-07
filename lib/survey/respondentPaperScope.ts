import { isInRespondentScope } from "@/lib/survey/poolEligibility"

export type RespondentPaperScope = {
    domain?: string
    journal?: string
}

type ScopedRow = {
    domain?: string | null
    journal?: string | null
}

/** Journal/domain from the respondent's primary corresponding-author paper (newest first). */
export function pickRespondentScopeFromOwnPapers(
    ownPapers: ScopedRow[]
): RespondentPaperScope {
    const anchor = ownPapers[0]
    if (!anchor) return {}
    const journal = anchor.journal?.trim()
    return {
        domain: anchor.domain?.trim() || undefined,
        journal: journal || undefined,
    }
}

export function mergeRespondentScope(
    primary: RespondentPaperScope,
    fallback: RespondentPaperScope
): RespondentPaperScope {
    return {
        domain: primary.domain ?? fallback.domain,
        journal: primary.journal ?? fallback.journal,
    }
}

export function filterRowsToRespondentScope<T extends ScopedRow>(
    rows: T[],
    scope: RespondentPaperScope
): T[] {
    if (!scope.domain && !scope.journal) return rows
    return rows.filter((row) => isInRespondentScope(row, scope))
}

/** Identified respondents must have a journal anchor before fillers are selected. */
export function respondentScopeIsComplete(scope: RespondentPaperScope): boolean {
    return typeof scope.journal === "string" && scope.journal.length > 0
}
