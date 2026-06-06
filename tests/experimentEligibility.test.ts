import { describe, expect, it } from "vitest"
import {
    filterWorksForExperiment,
    isExperimentEligible,
    workIsExperimentEligible,
} from "@/lib/survey/experimentEligibility"

describe("experimentEligibility", () => {
    it("treats missing eligibility as experiment A only", () => {
        expect(isExperimentEligible(undefined, "A")).toBe(true)
        expect(isExperimentEligible([], "A")).toBe(true)
        expect(isExperimentEligible(undefined, "B")).toBe(false)
        expect(isExperimentEligible([], "C")).toBe(false)
    })

    it("requires explicit B or C in eligibility arrays", () => {
        expect(isExperimentEligible(["A", "C"], "B")).toBe(false)
        expect(isExperimentEligible(["A", "B", "C"], "B")).toBe(true)
        expect(isExperimentEligible(["A", "C"], "C")).toBe(true)
    })

    it("filters works for the requested experiment", () => {
        const works = [
            { work_id: "w1", experiment_eligibility: ["A", "B", "C"] },
            { work_id: "w2", experiment_eligibility: ["A", "C"] },
            { work_id: "w3", experiment_eligibility: ["A"] },
        ]
        expect(filterWorksForExperiment(works, "B").map((w) => w.work_id)).toEqual(["w1"])
        expect(filterWorksForExperiment(works, "A").map((w) => w.work_id)).toEqual([
            "w1",
            "w2",
            "w3",
        ])
    })

    it("works with workIsExperimentEligible helper", () => {
        expect(workIsExperimentEligible({ experiment_eligibility: ["A", "B"] }, "B")).toBe(true)
        expect(workIsExperimentEligible({ experiment_eligibility: ["A"] }, "B")).toBe(false)
    })
})
