export const FUNNEL_STEPS = [
    "landing",
    "demographics",
    "credit_roles",
    "position_beliefs_roles",
    "position_beliefs_authors",
    "role_importance",
    "trial",
    "task_1",
    "task_2",
    "task_3",
    "task_4",
    "task_5",
    "results",
    "consent",
    "study_complete",
] as const

export type FunnelStep = (typeof FUNNEL_STEPS)[number]

const SESSION_STORAGE_KEY = "survey_funnel_session_id"
const COOKIE_NAME = "survey_funnel_session_id"

/**
 * Get or initialize a unique persistent session ID for the current browser session.
 */
export function getOrCreateSessionId(): string {
    if (typeof window === "undefined") return ""

    // 1. Check sessionStorage
    let id = window.sessionStorage.getItem(SESSION_STORAGE_KEY)

    // 2. Check cookie fallback
    if (!id && typeof document !== "undefined") {
        const match = document.cookie.match(/(?:^|; )survey_funnel_session_id=([^;]*)/)
        if (match) {
            id = decodeURIComponent(match[1])
        }
    }

    // 3. Generate if not found
    if (!id) {
        id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    }

    // Persist to both sessionStorage and cookie
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, id)
    if (typeof document !== "undefined") {
        document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=86400; SameSite=Lax`
    }

    return id
}

export type TrackStepPayload = {
    step: FunnelStep | string
    sessionId?: string
    authorId?: string | null
    experimentType?: string | null
    demographics?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
    isCompleted?: boolean
    responseId?: string | null
}

/**
 * Sends a non-blocking step tracking event to /api/survey/track-step.
 */
export function trackSurveyStep(payload: TrackStepPayload): void {
    if (typeof window === "undefined") return

    const sessionId = payload.sessionId || getOrCreateSessionId()
    if (!sessionId) return

    const body: TrackStepPayload = {
        ...payload,
        sessionId,
        metadata: {
            screen_width: window.innerWidth,
            screen_height: window.innerHeight,
            referrer: document.referrer || null,
            pathname: window.location.pathname,
            ...payload.metadata,
        },
    }

    try {
        const jsonString = JSON.stringify(body)

        // Try navigator.sendBeacon if available (ideal for unloads and non-blocking delivery)
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            const blob = new Blob([jsonString], { type: "application/json" })
            const success = navigator.sendBeacon("/api/survey/track-step", blob)
            if (success) return
        }

        // Fallback to fetch with keepalive
        fetch("/api/survey/track-step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: jsonString,
            keepalive: true,
        }).catch(() => {
            // Silently ignore telemetry transmission errors
        })
    } catch {
        // Silently ignore telemetry transmission errors
    }
}
