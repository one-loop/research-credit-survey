import { describe, expect, it } from "vitest"
import {
    experimentFromOrderedResponses,
    pickRandomExperiment,
    resolveExperimentAssignment,
    type ExperimentType,
} from "@/lib/survey/experimentAssignment"

describe("pickRandomExperiment", () => {
    it("can place respondent in A, B, or C when B is allowed", () => {
        const hits = new Set<ExperimentType>()
        for (let i = 0; i < 300; i++) {
            hits.add(pickRandomExperiment({ allowB: true, random: Math.random }))
        }
        expect(hits.has("A")).toBe(true)
        expect(hits.has("B")).toBe(true)
        expect(hits.has("C")).toBe(true)
    })

    it("never picks B when B is not allowed", () => {
        for (let i = 0; i < 200; i++) {
            expect(pickRandomExperiment({ allowB: false, random: Math.random })).not.toBe("B")
        }
    })

    it("respects injected RNG for deterministic choice", () => {
        let n = 0
        const seq = () => {
            const vals = [0, 0.34, 0.67]
            return vals[n++ % vals.length]!
        }
        expect(pickRandomExperiment({ allowB: true, random: seq })).toBe("A")
        expect(pickRandomExperiment({ allowB: true, random: seq })).toBe("B")
        expect(pickRandomExperiment({ allowB: true, random: seq })).toBe("C")
    })
})

describe("resolveExperimentAssignment — seen work lock", () => {
    it("locks to experiment A when seen work was in A", () => {
        const r = resolveExperimentAssignment({
            seenExperiment: "A",
            allowB: true,
            random: () => 0.99,
        })
        expect(r).toEqual({ experiment: "A", lockedBySeenWork: true })
    })

    it("locks to experiment C when seen work was in C", () => {
        const r = resolveExperimentAssignment({
            seenExperiment: "C",
            allowB: false,
            random: () => 0,
        })
        expect(r).toEqual({ experiment: "C", lockedBySeenWork: true })
    })

    it("locks to B when seen work was in B and respondent is B-eligible", () => {
        const r = resolveExperimentAssignment({
            seenExperiment: "B",
            allowB: true,
            random: () => 0,
        })
        expect(r).toEqual({ experiment: "B", lockedBySeenWork: true })
    })

    it("does not lock to B when seen work was B but respondent is not B-eligible; falls back to random", () => {
        const r = resolveExperimentAssignment({
            seenExperiment: "B",
            allowB: false,
            random: () => 0,
        })
        expect(r.lockedBySeenWork).toBe(false)
        expect(["A", "C"] as const).toContain(r.experiment)
        expect(r.experiment).toBe("A")
    })
})

describe("resolveExperimentAssignment — no seen work", () => {
    it("randomizes among A,B,C when allowB is true", () => {
        const hits = new Set<ExperimentType>()
        for (let i = 0; i < 300; i++) {
            const r = resolveExperimentAssignment({
                seenExperiment: null,
                allowB: true,
                random: Math.random,
            })
            expect(r.lockedBySeenWork).toBe(false)
            hits.add(r.experiment)
        }
        expect(hits.has("A")).toBe(true)
        expect(hits.has("B")).toBe(true)
        expect(hits.has("C")).toBe(true)
    })

    it("randomizes only A or C when allowB is false", () => {
        for (let i = 0; i < 100; i++) {
            const r = resolveExperimentAssignment({
                seenExperiment: null,
                allowB: false,
                random: Math.random,
            })
            expect(r.lockedBySeenWork).toBe(false)
            expect(r.experiment).not.toBe("B")
        }
    })
})

describe("experimentFromOrderedResponses — most recent seen work", () => {
    it("returns the experiment of the newest response row (first in list)", () => {
        const exp = experimentFromOrderedResponses([
            { experiment_type: "B", created_at: "2026-05-01T12:00:00Z" },
            { experiment_type: "A", created_at: "2026-04-01T12:00:00Z" },
        ])
        expect(exp).toBe("B")
    })

    it("uses the first valid A/B/C when multiple rows exist", () => {
        const exp = experimentFromOrderedResponses([
            { experiment_type: "C", created_at: "2026-06-01T00:00:00Z" },
            { experiment_type: "A", created_at: "2026-05-01T00:00:00Z" },
        ])
        expect(exp).toBe("C")
    })

    it("skips invalid experiment_type and uses the next row", () => {
        const exp = experimentFromOrderedResponses([
            { experiment_type: null, created_at: "2026-06-01T00:00:00Z" },
            { experiment_type: "A", created_at: "2026-05-01T00:00:00Z" },
        ])
        expect(exp).toBe("A")
    })

    it("returns null when there is no qualifying response", () => {
        expect(experimentFromOrderedResponses([])).toBeNull()
        expect(experimentFromOrderedResponses([{ experiment_type: "X", created_at: "2026-01-01Z" }])).toBeNull()
    })
})
