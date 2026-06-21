import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getParticipantAuthorId } from "@/lib/survey/participant"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"

const RESPONSES_PATH = path.join(process.cwd(), "data", "responses.json")
const MAX_FEEDBACK_LENGTH = 4_000

async function mergeLocalFeedback(responseId: string, feedback: string): Promise<boolean> {
    try {
        const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
        const arr = JSON.parse(raw) as unknown[]
        const idx = arr.findIndex(
            (r) =>
                typeof r === "object" &&
                r !== null &&
                "responseId" in r &&
                (r as { responseId: string }).responseId === responseId
        )
        if (idx === -1) return false
        const row = arr[idx] as Record<string, unknown>
        row.feedback = feedback
        row.feedback_submitted_at = new Date().toISOString()
        await fs.writeFile(RESPONSES_PATH, JSON.stringify(arr, null, 2), "utf-8")
        return true
    } catch {
        return false
    }
}

async function resolveResponseId(opts: {
    responseId?: string
    authorId: string | undefined
    experimentType: ExperimentType
    queueIndex: number
}): Promise<string | null> {
    if (opts.responseId) return opts.responseId
    if (!opts.authorId || !isSupabaseConfigured()) return null

    const supabase = getSupabase()
    const { data, error } = await supabase
        .from("experiment_responses")
        .select("id")
        .eq("author_id", opts.authorId)
        .eq("experiment_type", opts.experimentType)
        .eq("queue_index", opts.queueIndex)
        .order("created_at", { ascending: false })
        .limit(1)

    if (error || !data?.length) return null
    return typeof data[0]?.id === "string" ? data[0].id : null
}

export async function POST(request: NextRequest) {
    let body: {
        feedback?: unknown
        responseId?: string
        experimentType?: ExperimentType
        queueIndex?: number
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (typeof body.feedback !== "string") {
        return NextResponse.json({ error: "feedback must be a string" }, { status: 400 })
    }

    const feedback = body.feedback.trim()
    if (!feedback) {
        return NextResponse.json({ error: "feedback cannot be empty" }, { status: 400 })
    }
    if (feedback.length > MAX_FEEDBACK_LENGTH) {
        return NextResponse.json({ error: "feedback is too long" }, { status: 400 })
    }

    const experimentType =
        body.experimentType === "B" || body.experimentType === "C" ? body.experimentType : "A"
    const queueRaw = Number(body.queueIndex ?? "0")
    const queueIndex = Number.isFinite(queueRaw) && queueRaw >= 0 ? Math.floor(queueRaw) : 0
    const authorId = getParticipantAuthorId(request)

    const responseId = await resolveResponseId({
        responseId:
            typeof body.responseId === "string" && body.responseId.trim().length > 0
                ? body.responseId.trim()
                : undefined,
        authorId,
        experimentType,
        queueIndex,
    })

    if (!responseId) {
        return NextResponse.json({ error: "Response not found" }, { status: 404 })
    }

    if (isSupabaseConfigured()) {
        const supabase = getSupabase()
        let query = supabase
            .from("experiment_responses")
            .update({ feedback })
            .eq("id", responseId)
        if (authorId) {
            query = query.eq("author_id", authorId)
        }
        const { data, error } = await query.select("id")

        if (error) {
            console.error("[survey/feedback] save failed:", error.message)
            return NextResponse.json({ ok: false, error: "Failed to save feedback" }, { status: 500 })
        }
        if (!data?.length) {
            return NextResponse.json({ error: "Response not found" }, { status: 404 })
        }
    } else {
        const localUpdated = await mergeLocalFeedback(responseId, feedback)
        if (!localUpdated) {
            return NextResponse.json({ error: "Response not found" }, { status: 404 })
        }
    }

    return NextResponse.json({ ok: true, responseId })
}
