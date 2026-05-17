import { describe, expect, it } from "vitest"
import {
    recalculateEligibilityPoolForNextQueue,
    selectNextOwnWorkId,
    selectQueueFromEligibilityPool,
    type QueueCandidate,
} from "@/lib/survey/queueSelection"

function makePool(): QueueCandidate[] {
    return [
        { work_id: "own", isOwnWork: true, seenCount: 0 },
        { work_id: "s1", seenCount: 2 },
        { work_id: "s2", seenCount: 2 },
        { work_id: "s3", seenCount: 1 },
        { work_id: "s4", seenCount: 1 },
        { work_id: "s5", seenCount: 1 },
        { work_id: "u1", seenCount: 0 },
        { work_id: "u2", seenCount: 0 },
        { work_id: "u3", seenCount: 0 },
    ]
}

describe("Queue selection", () => {
    it("selects 5 works and always includes respondent own work", () => {
        const queue = selectQueueFromEligibilityPool(makePool())
        expect(queue).toHaveLength(5)
        expect(queue.some((w) => w.isOwnWork)).toBe(true)
    })

    it("includes eligible seen works first, but no more than 4 per queue", () => {
        const queue = selectQueueFromEligibilityPool(makePool(), {
            queueSize: 5,
            maxSeenPerQueue: 4,
        })
        const seenCount = queue.filter((w) => (w.seenCount ?? 0) > 0).length
        expect(seenCount).toBeLessThanOrEqual(4)
        expect(seenCount).toBe(4)
    })

    it("throws when own work is missing", () => {
        const pool = makePool().filter((w) => !w.isOwnWork)
        expect(() => selectQueueFromEligibilityPool(pool)).toThrow(
            "Eligibility pool must include respondent own work."
        )
    })

    it("throws when queue cannot be filled from pool", () => {
        const tinyPool: QueueCandidate[] = [
            { work_id: "own", isOwnWork: true, seenCount: 0 },
            { work_id: "w1", seenCount: 1 },
        ]
        expect(() => selectQueueFromEligibilityPool(tinyPool)).toThrow(
            "Not enough eligible works to form a complete queue."
        )
    })
})

describe("Queue progression across rounds", () => {
    it("selects next own paper by recency as queues progress", () => {
        const ownByRecency = ["own_latest", "own_older", "own_oldest"]
        const shown = new Set<string>(["own_latest"])
        expect(selectNextOwnWorkId(ownByRecency, shown)).toBe("own_older")
        shown.add("own_older")
        expect(selectNextOwnWorkId(ownByRecency, shown)).toBe("own_oldest")
        shown.add("own_oldest")
        expect(selectNextOwnWorkId(ownByRecency, shown)).toBeUndefined()
    })

    it("recalculates next eligibility pool after queue completion", () => {
        const pool = makePool()
        const q0 = selectQueueFromEligibilityPool(pool)
        const nextPool = recalculateEligibilityPoolForNextQueue(
            pool,
            q0.map((w) => w.work_id),
            "own"
        )

        // own work is preserved for subsequent queues
        expect(nextPool.some((w) => w.work_id === "own")).toBe(true)

        // non-own works shown in previous queue are removed
        for (const w of q0) {
            if (w.work_id === "own") continue
            expect(nextPool.some((x) => x.work_id === w.work_id)).toBe(false)
        }
    })

    it("allows building multiple queues without overlap among non-own works", () => {
        const pool = makePool()
        const q0 = selectQueueFromEligibilityPool(pool)
        const p1 = recalculateEligibilityPoolForNextQueue(
            pool,
            q0.map((w) => w.work_id),
            "own"
        )
        const q1 = selectQueueFromEligibilityPool(p1)

        const q0NonOwn = new Set(q0.filter((w) => !w.isOwnWork).map((w) => w.work_id))
        const q1NonOwn = new Set(q1.filter((w) => !w.isOwnWork).map((w) => w.work_id))
        const overlap = [...q1NonOwn].filter((id) => q0NonOwn.has(id))
        expect(overlap).toHaveLength(0)
        expect(q1.some((w) => w.work_id === "own")).toBe(true)
    })
})

