import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { incrementWorkExposure } from "@/lib/db/papers"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import { creditRoles } from "@/lib/mockData"

const RESPONSES_PATH = path.join(process.cwd(), "data", "responses.json")

async function appendResponse(payload: {
    responseId: string
    workIds: string[]
    rankings: Record<string, string[]>
    authorId: string | null
    role_importance: Record<string, number>
    experimentType?: "A" | "B" | "C"
    completedAt: string
    time_spent?: Record<string, number> | null
}): Promise<void> {
    let existing: unknown[] = []
    try {
        const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
        existing = JSON.parse(raw) as unknown[]
    } catch {
        // file may not exist yet
    }
    existing.push(payload)
    await fs.mkdir(path.dirname(RESPONSES_PATH), { recursive: true })
    await fs.writeFile(RESPONSES_PATH, JSON.stringify(existing, null, 2), "utf-8")
}

export async function POST(request: NextRequest) {
    let body: {
        workIds: string[]
        rankings: Record<string, string[]>
        authorId?: string
        roleImportance?: Record<string, number>
        experimentType?: "A" | "B" | "C"
        timeSpent?: Record<string, number> | null
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    const { workIds, rankings, authorId, roleImportance, experimentType, timeSpent } = body
    if (!Array.isArray(workIds) || !rankings || typeof rankings !== "object") {
        return NextResponse.json(
            { error: "Body must include workIds (array) and rankings (object)" },
            { status: 400 }
        )
    }

    const roleImportanceWithDefault =
        roleImportance ??
        (Object.fromEntries(creditRoles.map((r) => [r.id, 5])) as Record<string, number>)

    let responseId: string

    if (isSupabaseConfigured()) {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .insert({
                author_id: authorId ?? null,
                work_ids: workIds,
                rankings, // stored as JSONB
                role_importance: roleImportanceWithDefault,
                experiment_type: experimentType ?? null,
                time_spent: timeSpent ?? null,
            })
            .select("id")
            .single()

        if (error) {
            console.error("Failed to save experiment response:", error.message)
            return NextResponse.json(
                { ok: false, error: "Failed to save survey response" },
                { status: 500 }
            )
        }
        responseId = data.id as string
    } else {
        responseId = randomUUID()
    }

    // Local JSON is only for offline/dev: serverless deploys have a read-only filesystem,
    // so writing here would throw after a successful Supabase insert and break the client flow.
    if (!isSupabaseConfigured()) {
        await appendResponse({
            responseId,
            workIds,
            rankings,
            authorId: authorId ?? null,
            role_importance: roleImportanceWithDefault,
            experimentType,
            completedAt: new Date().toISOString(),
            time_spent: timeSpent ?? null,
        })
    }

    if (isSupabaseConfigured()) {
        await incrementWorkExposure(workIds)
    }

    return NextResponse.json({ ok: true, responseId })
}
