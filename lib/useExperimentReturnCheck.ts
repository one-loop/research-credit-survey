"use client"

import { useEffect, useState } from "react"
import { shouldShowExperimentThanksScreen } from "@/lib/survey/experimentCompletion"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"

export type ExperimentReturnCheck = {
    /** Participant cookie resolved and completion status fetched (or skipped). */
    ready: boolean
    /** Show thank-you / continue screen instead of the experiment. */
    showThanks: boolean
    /** Latest saved queue_index for this experiment (for thanks UI). */
    latestQueueIndex: number
    /** Respondent has at least one saved response in this experiment. */
    hasPriorResponses: boolean
}

export function useExperimentReturnCheck(
    experimentType: ExperimentType,
    queueIndex: number
): ExperimentReturnCheck {
    const { authorId, ready: participantReady } = useSurveyParticipant()
    const [status, setStatus] = useState<"pending" | "resolved">("pending")
    const [showThanks, setShowThanks] = useState(false)
    const [latestQueueIndex, setLatestQueueIndex] = useState(0)
    const [hasPriorResponses, setHasPriorResponses] = useState(false)

    useEffect(() => {
        if (!participantReady) return

        if (!authorId) {
            setShowThanks(false)
            setHasPriorResponses(false)
            setStatus("resolved")
            return
        }

        let cancelled = false
        setStatus("pending")

        const params = new URLSearchParams({ experimentType })
        fetch(`/api/survey/completion-status?${params.toString()}`, { credentials: "same-origin" })
            .then((res) => (res.ok ? res.json() : Promise.resolve({ hasCompleted: false, latestQueueIndex: null })))
            .then((data: { hasCompleted?: boolean; latestQueueIndex?: number | null }) => {
                if (cancelled) return
                const completion = {
                    hasCompleted: Boolean(data.hasCompleted),
                    latestQueueIndex:
                        typeof data.latestQueueIndex === "number" && data.latestQueueIndex >= 0
                            ? Math.floor(data.latestQueueIndex)
                            : null,
                }
                setHasPriorResponses(completion.hasCompleted)
                setLatestQueueIndex(completion.latestQueueIndex ?? 0)
                setShowThanks(shouldShowExperimentThanksScreen(queueIndex, completion))
                setStatus("resolved")
            })
            .catch(() => {
                if (cancelled) return
                setShowThanks(false)
                setHasPriorResponses(false)
                setStatus("resolved")
            })

        return () => {
            cancelled = true
        }
    }, [participantReady, authorId, experimentType, queueIndex])

    return {
        ready: participantReady && status === "resolved",
        showThanks,
        latestQueueIndex,
        hasPriorResponses,
    }
}
