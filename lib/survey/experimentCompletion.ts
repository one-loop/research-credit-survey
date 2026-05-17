import type { ExperimentType } from "@/lib/survey/experimentAssignment"

export type ExperimentCompletionStatus = {
    hasCompleted: boolean
    latestQueueIndex: number | null
}

/**
 * True when the respondent already finished the batch for this URL queue index
 * and should see the thank-you / continue screen instead of the experiment.
 */
export function shouldShowExperimentThanksScreen(
    queueIndex: number,
    status: ExperimentCompletionStatus
): boolean {
    if (!status.hasCompleted || status.latestQueueIndex === null) return false
    return queueIndex <= status.latestQueueIndex
}

export type ExperimentTypeParam = ExperimentType
