import type { ExperimentType } from "@/lib/survey/experimentAssignment"

/** Whether a paper may appear in the given experiment. */
export function isExperimentEligible(
    eligibility: string[] | null | undefined,
    experimentType: ExperimentType
): boolean {
    if (!Array.isArray(eligibility) || eligibility.length === 0) {
        return experimentType === "A"
    }
    return eligibility.includes(experimentType)
}

export function workIsExperimentEligible(
    work: { experiment_eligibility?: string[] | null },
    experimentType: ExperimentType
): boolean {
    return isExperimentEligible(work.experiment_eligibility, experimentType)
}

export function filterWorksForExperiment<T extends { experiment_eligibility?: string[] | null }>(
    works: T[],
    experimentType: ExperimentType
): T[] {
    return works.filter((work) => workIsExperimentEligible(work, experimentType))
}
