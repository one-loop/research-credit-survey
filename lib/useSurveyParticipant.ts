"use client"

import { useEffect, useState } from "react"
import { SURVEY_PARTICIPANT_STORAGE_KEY } from "@/lib/survey/participant"

/**
 * Resolves participant author id via httpOnly cookie (same-origin fetch).
 * Caches in sessionStorage for synchronous session keys on subsequent navigations.
 */
export function useSurveyParticipant(): {
    authorId: string | undefined
    ready: boolean
} {
    const [authorId, setAuthorId] = useState<string | undefined>(() => {
        if (typeof window === "undefined") return undefined
        return sessionStorage.getItem(SURVEY_PARTICIPANT_STORAGE_KEY) ?? undefined
    })
    const [ready, setReady] = useState(false)

    useEffect(() => {
        let cancelled = false
        fetch("/api/survey/participant", { credentials: "same-origin" })
            .then((res) => (res.ok ? res.json() : Promise.resolve({ authorId: null })))
            .then((data: { authorId?: string | null }) => {
                if (cancelled) return
                const id =
                    typeof data.authorId === "string" && data.authorId.length > 0 ? data.authorId : undefined
                setAuthorId(id)
                if (typeof window !== "undefined") {
                    if (id) sessionStorage.setItem(SURVEY_PARTICIPANT_STORAGE_KEY, id)
                    else sessionStorage.removeItem(SURVEY_PARTICIPANT_STORAGE_KEY)
                }
                setReady(true)
            })
            .catch(() => {
                if (!cancelled) setReady(true)
            })
        return () => {
            cancelled = true
        }
    }, [])

    return { authorId, ready }
}
