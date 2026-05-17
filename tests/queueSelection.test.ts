import { describe, expect, it } from "vitest"
import {
    buildQueueForRound,
    recalculateEligibilityPoolForNextQueue,
    selectNextOwnWorkId,
    selectQueueFromEligibilityPool,
    simulateRespondentQueues,
    setRespondentOwnWorkInPool,
    type QueueCandidate,
} from "@/lib/survey/queueSelection"

const QUEUE_SIZE = 5
const MAX_SEEN_PER_QUEUE = 4

function fillers(
    entries: Array<{ id: string; seenCount?: number }>
): QueueCandidate[] {
    return entries.map(({ id, seenCount = 0 }) => ({
        work_id: id,
        seenCount,
        isOwnWork: false,
    }))
}

function makeRichPool(): QueueCandidate[] {
    return fillers([
        { id: "s1", seenCount: 2 },
        { id: "s2", seenCount: 2 },
        { id: "s3", seenCount: 1 },
        { id: "s4", seenCount: 1 },
        { id: "s5", seenCount: 1 },
        { id: "u1", seenCount: 0 },
        { id: "u2", seenCount: 0 },
        { id: "u3", seenCount: 0 },
        { id: "u4", seenCount: 0 },
        { id: "u5", seenCount: 0 },
    ])
}

/** Enough fillers to run several consecutive queues after recalculation. */
function makeLargePool(): QueueCandidate[] {
    const seen = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map((id, i) => ({
        id,
        seenCount: (i % 3) + 1,
    }))
    const unseen = Array.from({ length: 24 }, (_, i) => ({
        id: `u${i + 1}`,
        seenCount: 0,
    }))
    return fillers([...seen, ...unseen])
}

function poolWithOwn(ownId: string, rest: QueueCandidate[]): QueueCandidate[] {
    return setRespondentOwnWorkInPool(rest, ownId)
}

describe("Queue — select 5 works from eligibility pool", () => {
    it("always returns exactly 5 works", () => {
        const queue = selectQueueFromEligibilityPool(
            poolWithOwn("own", makeRichPool()),
            { queueSize: QUEUE_SIZE }
        )
        expect(queue).toHaveLength(QUEUE_SIZE)
    })

    it("throws when the pool cannot supply 5 works", () => {
        const tiny = poolWithOwn("own", fillers([{ id: "w1", seenCount: 1 }]))
        expect(() =>
            selectQueueFromEligibilityPool(tiny, { queueSize: QUEUE_SIZE })
        ).toThrow("Not enough eligible works to form a complete queue.")
    })

    it("throws when respondent own work is missing from the pool", () => {
        expect(() => selectQueueFromEligibilityPool(makeRichPool())).toThrow(
            "Eligibility pool must include respondent own work."
        )
    })
})

describe("Queue — respondent own work (exactly one per queue)", () => {
    it("includes exactly one own work in every queue", () => {
        const queue = selectQueueFromEligibilityPool(
            poolWithOwn("own", makeRichPool())
        )
        expect(queue.filter((w) => w.isOwnWork)).toHaveLength(1)
    })
})

describe("Queue — eligible seen works (required, up to 4 per queue)", () => {
    it("includes all eligible seen works when there are fewer than 4", () => {
        const pool = poolWithOwn(
            "own",
            fillers([
                { id: "seen_a", seenCount: 3 },
                { id: "seen_b", seenCount: 1 },
                { id: "u1" },
                { id: "u2" },
                { id: "u3" },
            ])
        )
        const queue = selectQueueFromEligibilityPool(pool, {
            queueSize: QUEUE_SIZE,
            maxSeenPerQueue: MAX_SEEN_PER_QUEUE,
        })
        const seenInQueue = queue.filter((w) => (w.seenCount ?? 0) > 0)
        expect(seenInQueue.map((w) => w.work_id).sort()).toEqual(
            ["seen_a", "seen_b"].sort()
        )
    })

    it("includes exactly 4 seen works when more than 4 are eligible", () => {
        const queue = selectQueueFromEligibilityPool(
            poolWithOwn("own", makeRichPool()),
            { queueSize: QUEUE_SIZE, maxSeenPerQueue: MAX_SEEN_PER_QUEUE }
        )
        const seenCount = queue.filter((w) => (w.seenCount ?? 0) > 0).length
        expect(seenCount).toBe(MAX_SEEN_PER_QUEUE)
    })

    it("never includes more than 4 seen works per queue", () => {
        const queue = selectQueueFromEligibilityPool(
            poolWithOwn("own", makeRichPool()),
            { maxSeenPerQueue: MAX_SEEN_PER_QUEUE }
        )
        expect(queue.filter((w) => (w.seenCount ?? 0) > 0).length).toBeLessThanOrEqual(
            MAX_SEEN_PER_QUEUE
        )
    })

    it("prefers higher seenCount when choosing which seen works to show", () => {
        const queue = selectQueueFromEligibilityPool(
            poolWithOwn("own", makeRichPool()),
            { maxSeenPerQueue: MAX_SEEN_PER_QUEUE }
        )
        const seenIds = new Set(
            queue.filter((w) => (w.seenCount ?? 0) > 0).map((w) => w.work_id)
        )
        expect(seenIds.has("s1")).toBe(true)
        expect(seenIds.has("s2")).toBe(true)
    })

    it("fills remaining slots with unseen works when seen cap is not reached", () => {
        const pool = poolWithOwn(
            "own",
            fillers([{ id: "seen_only", seenCount: 2 }, { id: "u1" }, { id: "u2" }, { id: "u3" }])
        )
        const queue = selectQueueFromEligibilityPool(pool)
        expect(queue.some((w) => w.work_id === "seen_only")).toBe(true)
        expect(queue.filter((w) => (w.seenCount ?? 0) === 0).length).toBeGreaterThan(0)
    })
})

describe("Queue — numbering and optional continuation (0, 1, 2, … N)", () => {
    it("numbers queues 0, 1, 2 when the respondent continues", () => {
        const ownWorks = ["own_latest", "own_older", "own_oldest"]
        const simulated = simulateRespondentQueues({
            pool: makeLargePool(),
            ownWorkIdsNewestFirst: ownWorks,
            maxQueues: 3,
        })
        expect(simulated.map((s) => s.queueIndex)).toEqual([0, 1, 2])
    })

    it("stops when the respondent chooses not to continue (maxQueues)", () => {
        const simulated = simulateRespondentQueues({
            pool: makeRichPool(),
            ownWorkIdsNewestFirst: ["own_a", "own_b", "own_c"],
            maxQueues: 1,
        })
        expect(simulated).toHaveLength(1)
        expect(simulated[0]?.queueIndex).toBe(0)
    })

    it("allows as many queues as own works and pool depth support", () => {
        const simulated = simulateRespondentQueues({
            pool: makeRichPool(),
            ownWorkIdsNewestFirst: ["own_a"],
        })
        expect(simulated.length).toBeGreaterThanOrEqual(1)
        for (const { queue } of simulated) {
            expect(queue).toHaveLength(QUEUE_SIZE)
        }
    })
})

describe("Queue — recalculate eligibility pool after each queue", () => {
    it("removes non-own works shown in the completed queue", () => {
        const base = poolWithOwn("own", makeRichPool())
        const q0 = selectQueueFromEligibilityPool(base)
        const nextPool = recalculateEligibilityPoolForNextQueue(
            base,
            q0.map((w) => w.work_id),
            undefined
        )
        for (const w of q0) {
            if (w.work_id === "own") continue
            expect(nextPool.some((x) => x.work_id === w.work_id)).toBe(false)
        }
    })

    it("recalculates before each subsequent queue in simulation", () => {
        const simulated = simulateRespondentQueues({
            pool: makeRichPool(),
            ownWorkIdsNewestFirst: ["own_a", "own_b"],
            maxQueues: 2,
        })
        expect(simulated).toHaveLength(2)
        const q0NonOwn = simulated[0]!.queue.filter((w) => !w.isOwnWork).map((w) => w.work_id)
        const q1NonOwn = simulated[1]!.queue.filter((w) => !w.isOwnWork).map((w) => w.work_id)
        const overlap = q1NonOwn.filter((id) => q0NonOwn.includes(id))
        expect(overlap).toHaveLength(0)
    })
})

describe("Own works — Queue 0: most recent corresponding-author work", () => {
    const ownByRecency = ["own_2024", "own_2023", "own_2022"]

    it("selects the most recent own work when none have been shown", () => {
        expect(selectNextOwnWorkId(ownByRecency, new Set())).toBe("own_2024")
    })

    it("queue 0 shows exactly that most recent own work", () => {
        const built = buildQueueForRound({
            pool: makeRichPool(),
            ownWorkIdsNewestFirst: ownByRecency,
            shownOwnWorkIds: new Set(),
            worksShownInPriorQueues: [],
        })
        expect(built?.ownWorkId).toBe("own_2024")
        expect(built?.queue.filter((w) => w.isOwnWork)).toHaveLength(1)
        expect(built?.queue.some((w) => w.work_id === "own_2024")).toBe(true)
    })
})

describe("Own works — Queue 1+: one own work per batch until exhausted", () => {
    const ownByRecency = ["own_latest", "own_older", "own_oldest"]

    it("shows the next newest own work in each subsequent queue", () => {
        const simulated = simulateRespondentQueues({
            pool: makeLargePool(),
            ownWorkIdsNewestFirst: ownByRecency,
        })
        expect(simulated.map((s) => s.ownWorkId)).toEqual(ownByRecency)
    })

    it("shows exactly one own work per queue", () => {
        const simulated = simulateRespondentQueues({
            pool: makeLargePool(),
            ownWorkIdsNewestFirst: ownByRecency,
        })
        for (const { queue } of simulated) {
            expect(queue.filter((w) => w.isOwnWork)).toHaveLength(1)
        }
    })

    it("returns undefined when all corresponding-author works have been shown", () => {
        const shown = new Set(ownByRecency)
        expect(selectNextOwnWorkId(ownByRecency, shown)).toBeUndefined()
        expect(
            buildQueueForRound({
                pool: makeRichPool(),
                ownWorkIdsNewestFirst: ownByRecency,
                shownOwnWorkIds: shown,
                worksShownInPriorQueues: ownByRecency,
            })
        ).toBeNull()
    })

    it("does not repeat an own work in a later queue", () => {
        const simulated = simulateRespondentQueues({
            pool: makeLargePool(),
            ownWorkIdsNewestFirst: ownByRecency,
        })
        const ownIdsPerQueue = simulated.map((s) => s.ownWorkId)
        expect(new Set(ownIdsPerQueue).size).toBe(ownIdsPerQueue.length)
    })
})

describe("Own works — sorted by publication date (latest to oldest)", () => {
    it("iterates own works in newest-first order", () => {
        const ownByRecency = ["pub_2024", "pub_2023", "pub_2021"]
        const shown = new Set<string>()
        const order: string[] = []
        for (;;) {
            const next = selectNextOwnWorkId(ownByRecency, shown)
            if (!next) break
            order.push(next)
            shown.add(next)
        }
        expect(order).toEqual(ownByRecency)
    })

    it("uses publication order, not arbitrary list order, when picking next own work", () => {
        const shuffledInput = ["pub_old", "pub_new", "pub_mid"]
        const publicationOrder = ["pub_new", "pub_mid", "pub_old"]
        const shown = new Set<string>()
        const picked: string[] = []
        for (;;) {
            const next = selectNextOwnWorkId(publicationOrder, shown)
            if (!next) break
            picked.push(next)
            shown.add(next)
        }
        expect(picked).toEqual(publicationOrder)
        expect(shuffledInput).not.toEqual(publicationOrder)
    })
})

describe("buildQueueForRound integration", () => {
    it("composes recalculation, own-work injection, and 5-work selection", () => {
        const round0 = buildQueueForRound({
            pool: makeRichPool(),
            ownWorkIdsNewestFirst: ["own"],
            shownOwnWorkIds: new Set(),
            worksShownInPriorQueues: [],
        })
        expect(round0?.queue).toHaveLength(QUEUE_SIZE)

        const round1 = buildQueueForRound({
            pool: makeRichPool(),
            ownWorkIdsNewestFirst: ["own"],
            shownOwnWorkIds: new Set(["own"]),
            worksShownInPriorQueues: round0!.queue.map((w) => w.work_id),
        })
        expect(round1).toBeNull()
    })
})
