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
 * Recalculate pool after a queue is completed: remove works shown in that queue.
 * When `preserveWorkId` is set, that work stays in the pool even if it was shown
 * (used when the same own paper must remain eligible across rounds).
 */
export function recalculateEligibilityPoolForNextQueue(
    currentPool: QueueCandidate[],
    shownWorkIds: string[],
    preserveWorkId: string | undefined
): QueueCandidate[] {
    const shown = new Set(shownWorkIds)
    return currentPool.filter((w) => {
        if (preserveWorkId && w.work_id === preserveWorkId) return true
        return !shown.has(w.work_id)
    })
}

/** Mark exactly one work as the respondent's own paper for this queue. */
export function setRespondentOwnWorkInPool(
    pool: QueueCandidate[],
    ownWorkId: string
): QueueCandidate[] {
    const withoutOwnFlag = pool
        .filter((w) => w.work_id !== ownWorkId)
        .map((w) => ({ ...w, isOwnWork: false as const }))
    const existing = pool.find((w) => w.work_id === ownWorkId)
    const own: QueueCandidate = existing
        ? { ...existing, isOwnWork: true }
        : { work_id: ownWorkId, isOwnWork: true, seenCount: 0 }
    return [own, ...withoutOwnFlag]
}

export type BuildQueueForRoundInput = {
    /** Full eligibility pool (fillers; own work is injected per round). */
    pool: QueueCandidate[]
    /** Respondent's corresponding-author works, newest publication first. */
    ownWorkIdsNewestFirst: string[]
    /** Own work_ids already shown in prior queues for this experiment. */
    shownOwnWorkIds: Set<string>
    /** All work_ids shown in prior queues (including fillers and prior own papers). */
    worksShownInPriorQueues: string[]
    queueSize?: number
    maxSeenPerQueue?: number
}

/**
 * Build one numbered queue (0, 1, 2, …): pick next own work, recalculate pool, select 5 works.
 * Returns null when the respondent has no remaining corresponding-author works.
 */
export function buildQueueForRound(
    input: BuildQueueForRoundInput
): { queue: QueueCandidate[]; ownWorkId: string } | null {
    const ownWorkId = selectNextOwnWorkId(
        input.ownWorkIdsNewestFirst,
        input.shownOwnWorkIds
    )
    if (!ownWorkId) return null

    const filtered = recalculateEligibilityPoolForNextQueue(
        input.pool,
        input.worksShownInPriorQueues,
        undefined
    )
    const poolForRound = setRespondentOwnWorkInPool(filtered, ownWorkId)
    const queue = selectQueueFromEligibilityPool(poolForRound, {
        queueSize: input.queueSize,
        maxSeenPerQueue: input.maxSeenPerQueue,
    })
    return { queue, ownWorkId }
}

export type SimulateQueuesInput = {
    pool: QueueCandidate[]
    ownWorkIdsNewestFirst: string[]
    /** Stop after this many queues (optional). */
    maxQueues?: number
    queueSize?: number
    maxSeenPerQueue?: number
}

export type SimulatedQueue = {
    queueIndex: number
    queue: QueueCandidate[]
    ownWorkId: string
}

/**
 * Simulate a respondent completing as many queues as they choose (until own works run out
 * or the pool cannot fill another queue).
 */
export function simulateRespondentQueues(input: SimulateQueuesInput): SimulatedQueue[] {
    const results: SimulatedQueue[] = []
    const shownOwnWorkIds = new Set<string>()
    let worksShownInPriorQueues: string[] = []
    let queueIndex = 0

    while (input.maxQueues === undefined || queueIndex < input.maxQueues) {
        let built: { queue: QueueCandidate[]; ownWorkId: string } | null
        try {
            built = buildQueueForRound({
                pool: input.pool,
                ownWorkIdsNewestFirst: input.ownWorkIdsNewestFirst,
                shownOwnWorkIds,
                worksShownInPriorQueues,
                queueSize: input.queueSize,
                maxSeenPerQueue: input.maxSeenPerQueue,
            })
        } catch {
            break
        }
        if (!built) break

        results.push({ queueIndex, queue: built.queue, ownWorkId: built.ownWorkId })

        shownOwnWorkIds.add(built.ownWorkId)
        worksShownInPriorQueues = [
            ...worksShownInPriorQueues,
            ...built.queue.map((w) => w.work_id),
        ]
        queueIndex += 1
    }

    return results
}

