import { NextRequest, NextResponse } from "next/server"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import { FUNNEL_STEPS, type FunnelStep } from "@/lib/survey/funnelTracker"

function getStepRank(step: string): number {
    const idx = FUNNEL_STEPS.indexOf(step as FunnelStep)
    return idx >= 0 ? idx : -1
}

function resolveHighestStep(priorHighest: string | null | undefined, newStep: string): string {
    if (!priorHighest) return newStep
    const priorRank = getStepRank(priorHighest)
    const newRank = getStepRank(newStep)
    return newRank > priorRank ? newStep : priorHighest
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            sessionId,
            step,
            authorId,
            experimentType,
            demographics,
            metadata,
            isCompleted,
            responseId,
        } = body

        if (!sessionId || typeof sessionId !== "string") {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
        }

        const stepName = typeof step === "string" && step.trim().length > 0 ? step.trim() : "unknown"
        const now = new Date().toISOString()

        if (isSupabaseConfigured()) {
            const supabase = getSupabase()

            // Check if session already exists
            const { data: existing, error: selectError } = await supabase
                .from("survey_sessions")
                .select(
                    "id, current_step, highest_step, step_history, author_id, experiment_type, is_completed, demographics, metadata"
                )
                .eq("session_id", sessionId)
                .maybeSingle()

            if (selectError) {
                console.error("[track-step] Error reading session:", selectError.message)
            }

            if (existing) {
                const priorHistory: Array<{ step: string; entered_at: string }> = Array.isArray(
                    existing.step_history
                )
                    ? existing.step_history
                    : []

                // Only append to history if different from the very last entry
                const lastEntry = priorHistory[priorHistory.length - 1]
                const updatedHistory =
                    lastEntry && lastEntry.step === stepName
                        ? priorHistory
                        : [...priorHistory, { step: stepName, entered_at: now }]

                const highestStep = resolveHighestStep(existing.highest_step, stepName)

                const updatePayload: Record<string, unknown> = {
                    current_step: stepName,
                    highest_step: highestStep,
                    step_history: updatedHistory,
                    last_active_at: now,
                }

                if (authorId && !existing.author_id) updatePayload.author_id = authorId
                if (experimentType && !existing.experiment_type) updatePayload.experiment_type = experimentType
                if (demographics) {
                    const priorDemo =
                        typeof existing.demographics === "object" && existing.demographics !== null
                            ? (existing.demographics as Record<string, unknown>)
                            : {}
                    updatePayload.demographics = { ...priorDemo, ...demographics }
                }
                if (metadata) {
                    const priorMeta =
                        typeof existing.metadata === "object" && existing.metadata !== null
                            ? (existing.metadata as Record<string, unknown>)
                            : {}
                    updatePayload.metadata = { ...priorMeta, ...metadata }
                }
                if (isCompleted || existing.is_completed) {
                    updatePayload.is_completed = true
                    if (responseId) updatePayload.response_id = responseId
                }

                await supabase.from("survey_sessions").update(updatePayload).eq("session_id", sessionId)
            } else {
                // Insert brand new session
                const insertPayload: Record<string, unknown> = {
                    session_id: sessionId,
                    author_id: authorId ?? null,
                    experiment_type: experimentType ?? null,
                    current_step: stepName,
                    highest_step: stepName,
                    step_history: [{ step: stepName, entered_at: now }],
                    is_completed: Boolean(isCompleted),
                    response_id: responseId ?? null,
                    demographics: demographics ?? null,
                    metadata: metadata ?? null,
                    started_at: now,
                    last_active_at: now,
                }

                await supabase.from("survey_sessions").insert(insertPayload)
            }
        }

        return NextResponse.json({ ok: true })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Internal error"
        console.error("[track-step] Telemetry error:", msg)
        return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }
}
