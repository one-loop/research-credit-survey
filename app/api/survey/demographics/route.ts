import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

const RESPONSES_PATH = path.join(process.cwd(), "data", "responses.json")

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v)
}

async function mergeLocalDemographics(responseId: string, demographics: object): Promise<boolean> {
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
        row.respondent_demographics = demographics
        row.demographics_completed_at = new Date().toISOString()
        await fs.writeFile(RESPONSES_PATH, JSON.stringify(arr, null, 2), "utf-8")
        return true
    } catch {
        return false
    }
}

export async function POST(request: NextRequest) {
    let body: {
        responseId?: string
        demographics?: unknown
        authorId?: string | null
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { responseId, demographics, authorId } = body
    if (!responseId || typeof responseId !== "string") {
        return NextResponse.json({ error: "responseId is required" }, { status: 400 })
    }
    if (!isPlainObject(demographics)) {
        return NextResponse.json({ error: "demographics must be a JSON object" }, { status: 400 })
    }

    const payload = JSON.stringify(demographics)
    if (payload.length > 48_000) {
        return NextResponse.json({ error: "demographics payload too large" }, { status: 400 })
    }

    let supabaseUpdated = false
    if (isSupabaseConfigured()) {
        const supabase = getSupabase()
        let q = supabase
            .from("experiment_responses")
            .update({ respondent_demographics: demographics })
            .eq("id", responseId)
        if (authorId !== undefined && authorId !== null && authorId !== "") {
            q = q.eq("author_id", authorId)
        }
        const { data, error } = await q.select("id")

        if (error) {
            console.error("Failed to save demographics:", error.message)
            return NextResponse.json({ ok: false, error: "Failed to save demographics" }, { status: 500 })
        }
        supabaseUpdated = Boolean(data && data.length > 0)
    }

    const localUpdated = await mergeLocalDemographics(responseId, demographics)

    if (isSupabaseConfigured()) {
        if (!supabaseUpdated) {
            return NextResponse.json({ error: "Response not found" }, { status: 404 })
        }
    } else if (!localUpdated) {
        return NextResponse.json({ error: "Response not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
}
