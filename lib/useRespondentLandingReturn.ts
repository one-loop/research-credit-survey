"use client"

import { useEffect, useState } from "react"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"

export type RespondentLandingReturn = {
    ready: boolean
    showThanks: boolean
    experimentType: ExperimentType
    latestQueueIndex: number
    hasConsented: boolean
    consentStatus: string | null
}

const DEFAULT_EXPERIMENT: ExperimentType = "A"

export function useRespondentLandingReturn(): RespondentLandingReturn {
    const { authorId, ready: participantReady } = useSurveyParticipant()
    const [status, setStatus] = useState<"pending" | "resolved">("pending")
    const [showThanks, setShowThanks] = useState(false)
    const [experimentType, setExperimentType] = useState<ExperimentType>(DEFAULT_EXPERIMENT)
    const [latestQueueIndex, setLatestQueueIndex] = useState(0)
    const [hasConsented, setHasConsented] = useState(false)
    const [consentStatus, setConsentStatus] = useState<string | null>(null)

    useEffect(() => {
        if (!participantReady) return

        if (!authorId) {
            setShowThanks(false)
            setHasConsented(false)
            setConsentStatus(null)
            setStatus("resolved")
            return
        }

        let cancelled = false
        setStatus("pending")

        fetch("/api/survey/completion-status", { credentials: "same-origin" })
            .then((res) => (res.ok ? res.json() : Promise.resolve({ hasCompleted: false })))
            .then(
                (data: {
                    hasCompleted?: boolean
                    experimentType?: ExperimentType | null
                    latestQueueIndex?: number | null
                    hasConsented?: boolean
                    consentStatus?: string | null
                }) => {
                    if (cancelled) return
                    const completed = Boolean(data.hasCompleted)
                    setShowThanks(completed)
                    setHasConsented(Boolean(data.hasConsented))
                    setConsentStatus(data.consentStatus ?? null)
                    if (data.experimentType === "B" || data.experimentType === "C") {
                        setExperimentType(data.experimentType)
                    } else {
                        setExperimentType(DEFAULT_EXPERIMENT)
                    }
                    setLatestQueueIndex(
                        typeof data.latestQueueIndex === "number" && data.latestQueueIndex >= 0
                            ? Math.floor(data.latestQueueIndex)
                            : 0
                    )
                    setStatus("resolved")
                }
            )
            .catch(() => {
                if (cancelled) return
                setShowThanks(false)
                setHasConsented(false)
                setConsentStatus(null)
                setStatus("resolved")
            })

        return () => {
            cancelled = true
        }
    }, [participantReady, authorId])

    return {
        ready: participantReady && status === "resolved",
        showThanks,
        experimentType,
        latestQueueIndex,
        hasConsented,
        consentStatus,
    }
}
