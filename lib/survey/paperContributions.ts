/** Minimal author shape for contribution completeness checks. */
export type AuthorContributions = {
    contributions?: string[] | null
}

/** True when every author has at least one contribution tag. */
export function paperHasCompleteContributions(
    authors: AuthorContributions[] | null | undefined
): boolean {
    if (!authors?.length) return false
    return authors.every(
        (author) => Array.isArray(author.contributions) && author.contributions.length > 0
    )
}
