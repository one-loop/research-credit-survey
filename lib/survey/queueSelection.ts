export type QueueCandidate = {
    work_id: string
    isOwnWork?: boolean
    /**
     * Number of prior exposures from completed responses.
     * `> 0` means this is an eligible seen work.
     */
    seenCount?: number
}

/** Pick next own paper (newest-first list) not shown in prior queues. */
export function selectNextOwnWorkId(
    ownWorkIdsNewestFirst: string[],
    shownOwnWorkIds: Set<string>
): string | undefined {
    for (const id of ownWorkIdsNewestFirst) {
        if (!shownOwnWorkIds.has(id)) return id
    }
    return undefined
}

type QueueSelectionOptions = {
    queueSize?: number
    maxSeenPerQueue?: number
}

/**
 * Build one queue from an already-filtered eligibility pool.
 * Rules:
 * - Queue must include respondent own work.
 * - Include eligible seen works first (up to `maxSeenPerQueue`),
 *   then fill with unseen works.
 */
export function selectQueueFromEligibilityPool(
    pool: QueueCandidate[],
    opts: QueueSelectionOptions = {}
): QueueCandidate[] {
    const queueSize = opts.queueSize ?? 5
    const maxSeenPerQueue = opts.maxSeenPerQueue ?? 4

    if (queueSize <= 0) return []

    const ownWork = pool.find((w) => w.isOwnWork)
    if (!ownWork) {
        throw new Error("Eligibility pool must include respondent own work.")
    }

    const others = pool.filter((w) => w.work_id !== ownWork.work_id)
    const seen = others.filter((w) => (w.seenCount ?? 0) > 0)
    const unseen = others.filter((w) => (w.seenCount ?? 0) <= 0)

    // Deterministic preference: higher seen count first for repeat exposure.
    seen.sort((a, b) => (b.seenCount ?? 0) - (a.seenCount ?? 0))

    const queue: QueueCandidate[] = [ownWork]
    const remainingSlots = queueSize - 1
    const seenSlots = Math.min(maxSeenPerQueue, remainingSlots)

    for (const work of seen) {
        if (queue.length >= 1 + seenSlots) break
        queue.push(work)
    }
    for (const work of unseen) {
        if (queue.length >= queueSize) break
        queue.push(work)
    }

    if (queue.length < queueSize) {
        throw new Error("Not enough eligible works to form a complete queue.")
    }
    return queue
}

/**
 * Recalculate pool for the next queue after respondent finishes one queue.
 * Own work is preserved so each queue can continue including own paper.
 */
export function recalculateEligibilityPoolForNextQueue(
    currentPool: QueueCandidate[],
    shownWorkIds: string[],
    ownWorkId: string | undefined
): QueueCandidate[] {
    const shown = new Set(shownWorkIds)
    return currentPool.filter((w) => {
        if (ownWorkId && w.work_id === ownWorkId) return true
        return !shown.has(w.work_id)
    })
}

