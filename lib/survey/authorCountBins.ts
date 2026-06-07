export const AUTHOR_COUNT_BINS = [2, 3, 4, 5, "6-10"] as const

export type AuthorCountBin = (typeof AUTHOR_COUNT_BINS)[number]

export const WORKS_PER_AUTHOR_BIN_BATCH = AUTHOR_COUNT_BINS.length

/** Inclusive author-count range used when querying the papers pool for a bin. */
export function authorCountRangeForBin(
    bin: AuthorCountBin
): { min: number; max: number } {
    if (bin === "6-10") return { min: 6, max: 10 }
    return { min: bin, max: bin }
}

/** Map author count to survey bin (2, 3, 4, 5, or 6–10). */
export function authorCountToBin(count: number): AuthorCountBin | null {
    if (!Number.isFinite(count) || count < 2) return null
    if (count === 2) return 2
    if (count === 3) return 3
    if (count === 4) return 4
    if (count === 5) return 5
    if (count >= 6 && count <= 10) return "6-10"
    return null
}

export function shuffleAuthorCountBins(
    random: () => number = Math.random
): AuthorCountBin[] {
    const bins = [...AUTHOR_COUNT_BINS]
    for (let i = bins.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        const tmp = bins[i]!
        bins[i] = bins[j]!
        bins[j] = tmp
    }
    return bins
}

/** Primary bin first, then each subsequent bin in ring order for empty-bin fallback. */
export function fallbackBinsFor(primary: AuthorCountBin): AuthorCountBin[] {
    const start = AUTHOR_COUNT_BINS.indexOf(primary)
    if (start < 0) return [primary]
    const order: AuthorCountBin[] = []
    for (let step = 0; step < AUTHOR_COUNT_BINS.length; step++) {
        order.push(AUTHOR_COUNT_BINS[(start + step) % AUTHOR_COUNT_BINS.length]!)
    }
    return order
}

export type AuthorBinnedWork = {
    work_id: string
    authorCount: number
    isOwnWork?: boolean
}

export type SelectAuthorBinBatchOptions<T extends AuthorBinnedWork> = {
    candidates: T[]
    ownWork?: T | null
    /** Already-used work ids (e.g. prior own papers to exclude from fillers). */
    reservedWorkIds?: ReadonlySet<string>
    /** Return true when a candidate may be selected for this batch. */
    isEligible?: (work: T) => boolean
    /** Prefer earlier candidates within the same bin (exposure ordering). */
    random?: () => number
}

function pickFirstEligibleFromBin<T extends AuthorBinnedWork>(
    bucket: T[],
    usedIds: Set<string>,
    isEligible: (work: T) => boolean
): T | undefined {
    while (bucket.length > 0) {
        const next = bucket.shift()!
        if (usedIds.has(next.work_id)) continue
        if (!isEligible(next)) continue
        return next
    }
    return undefined
}

/**
 * Pick up to one work per author-count bin (5 total). Bin presentation order is shuffled.
 * Pass 1 prefers a unique bin per slot; pass 2 reuses bins so the queue still reaches 5 works.
 */
export function selectWorksOnePerAuthorBin<T extends AuthorBinnedWork>(
    opts: SelectAuthorBinBatchOptions<T>
): T[] {
    const {
        candidates,
        ownWork = null,
        reservedWorkIds = new Set<string>(),
        isEligible = () => true,
        random = Math.random,
    } = opts

    const selected: T[] = []
    const usedIds = new Set<string>(reservedWorkIds)
    const coveredBins = new Set<AuthorCountBin>()
    let ownAssigned = false

    const ownBin = ownWork ? authorCountToBin(ownWork.authorCount) : null

    const byBin = new Map<AuthorCountBin, T[]>()
    for (const bin of AUTHOR_COUNT_BINS) {
        byBin.set(bin, [])
    }
    for (const work of candidates) {
        if (usedIds.has(work.work_id)) continue
        const bin = authorCountToBin(work.authorCount)
        if (!bin) continue
        byBin.get(bin)!.push(work)
    }

    const binOrder = shuffleAuthorCountBins(random)

    function pickFromBins(
        binsToTry: AuthorCountBin[],
        allowReuse: boolean
    ): { work: T; bin: AuthorCountBin } | undefined {
        for (const tryBin of binsToTry) {
            if (!allowReuse && coveredBins.has(tryBin)) continue
            const candidate = pickFirstEligibleFromBin(
                byBin.get(tryBin) ?? [],
                usedIds,
                isEligible
            )
            if (candidate) return { work: candidate, bin: tryBin }
        }
        return undefined
    }

    function pickForSlot(slotBin: AuthorCountBin, allowReuse: boolean): T | undefined {
        if (
            !ownAssigned &&
            ownWork &&
            ownBin === slotBin &&
            isEligible(ownWork) &&
            !usedIds.has(ownWork.work_id)
        ) {
            return ownWork
        }

        const fromFallback = pickFromBins(fallbackBinsFor(slotBin), allowReuse)
        if (fromFallback) return fromFallback.work

        return pickFromBins([...AUTHOR_COUNT_BINS], allowReuse)?.work
    }

    for (const slotBin of binOrder) {
        let picked = pickForSlot(slotBin, false)
        if (!picked) picked = pickForSlot(slotBin, true)

        if (!picked) continue

        if (picked === ownWork) ownAssigned = true
        const pickedBin = authorCountToBin(picked.authorCount)
        if (pickedBin) coveredBins.add(pickedBin)

        selected.push(picked)
        usedIds.add(picked.work_id)
    }

    if (ownWork && !ownAssigned && isEligible(ownWork) && !usedIds.has(ownWork.work_id)) {
        if (selected.length >= WORKS_PER_AUTHOR_BIN_BATCH) {
            selected[selected.length - 1] = ownWork
        } else {
            selected.push(ownWork)
        }
    }

    return selected
}

export function batchCoversAllAuthorBins<T extends AuthorBinnedWork>(works: T[]): boolean {
    const bins = new Set(
        works
            .map((work) => authorCountToBin(work.authorCount))
            .filter((bin): bin is AuthorCountBin => bin !== null)
    )
    return AUTHOR_COUNT_BINS.every((bin) => bins.has(bin))
}
