export type AuthorForRankingAccuracy = {
    id: string
    equal_contrib?: boolean
}

/** Group consecutive equal-contribution authors into blocks (publication order). */
export function buildEqualContributionBlocks(authors: AuthorForRankingAccuracy[]): {
    authorToBlock: Map<string, number>
    canonicalBlockSequence: number[]
} {
    const blocks: string[][] = []
    let i = 0
    while (i < authors.length) {
        if (authors[i].equal_contrib) {
            const group: string[] = []
            while (i < authors.length && authors[i].equal_contrib) {
                group.push(authors[i].id)
                i++
            }
            blocks.push(group)
        } else {
            blocks.push([authors[i].id])
            i++
        }
    }

    const authorToBlock = new Map<string, number>()
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        for (const id of blocks[blockIndex]!) {
            authorToBlock.set(id, blockIndex)
        }
    }

    return {
        authorToBlock,
        canonicalBlockSequence: blocks.map((_, index) => index),
    }
}

/** Collapse a respondent ranking to block order (drops within-block repeats). */
export function collapseRankingToBlockSequence(
    ranking: string[],
    authorToBlock: Map<string, number>
): number[] {
    const sequence: number[] = []
    for (const authorId of ranking) {
        const block = authorToBlock.get(authorId)
        if (block === undefined) continue
        if (sequence.length === 0 || sequence[sequence.length - 1] !== block) {
            sequence.push(block)
        }
    }
    return sequence
}

/**
 * Kendall's tau for two sequences (permutation of the same ranks).
 * Returns a value in [-1, 1].
 */
export function kendallTau(reference: number[], respondent: number[]): number {
    const n = reference.length
    if (n !== respondent.length) return 0
    if (n < 2) return 1

    let concordant = 0
    let discordant = 0
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const refDiff = reference[i]! - reference[j]!
            const resDiff = respondent[i]! - respondent[j]!
            const product = refDiff * resDiff
            if (product > 0) concordant++
            else if (product < 0) discordant++
        }
    }

    const denominator = concordant + discordant
    if (denominator === 0) return 1
    return (concordant - discordant) / denominator
}

/** Map tau from [-1, 1] to accuracy in [0, 1]. */
export function tauToAccuracy(tau: number): number {
    return (tau + 1) / 2
}

/**
 * Accuracy for one work: Kendall's tau between canonical block order and the
 * respondent's ranking, treating equal-contribution authors as tied blocks.
 */
export function rankingAccuracyForWork(
    canonicalAuthors: AuthorForRankingAccuracy[],
    respondentRanking: string[]
): number | null {
    if (canonicalAuthors.length < 2 || respondentRanking.length < 2) {
        return canonicalAuthors.length <= 1 ? 1 : null
    }

    const { authorToBlock, canonicalBlockSequence } =
        buildEqualContributionBlocks(canonicalAuthors)
    const respondentBlocks = collapseRankingToBlockSequence(respondentRanking, authorToBlock)

    if (
        respondentBlocks.length !== canonicalBlockSequence.length ||
        respondentBlocks.length < 2
    ) {
        return null
    }

    const tau = kendallTau(canonicalBlockSequence, respondentBlocks)
    return tauToAccuracy(tau)
}

/** Mean accuracy across works; ignores works that cannot be scored. */
export function averageRankingAccuracy(perWork: Array<number | null>): number | null {
    const scored = perWork.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    if (scored.length === 0) return null
    return scored.reduce((sum, v) => sum + v, 0) / scored.length
}
