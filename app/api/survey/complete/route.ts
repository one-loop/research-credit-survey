import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { incrementWorkExposure } from "@/lib/db/papers"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

const RESPONSES_PATH = path.join(process.cwd(), "data", "responses.json")

async function appendResponse(payload: {
    workIds: string[]
    rankings: Record<string, string[]>
    completedAt: string
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
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    const { workIds, rankings, authorId, roleImportance } = body
    if (!Array.isArray(workIds) || !rankings || typeof rankings !== "object") {
        return NextResponse.json(
            { error: "Body must include workIds (array) and rankings (object)" },
            { status: 400 }
        )
    }

    if (isSupabaseConfigured()) {
        await incrementWorkExposure(workIds)

        const supabase = getSupabase()
        const { error } = await supabase
            .from("experiment_responses")
            .insert({
                author_id: authorId ?? null,
                work_ids: workIds,
                rankings, // stored as JSONB
                role_importance: roleImportance ?? null,
            })

        if (error) {
            console.error("Failed to save experiment response:", error.message)
        }
    }

    await appendResponse({
        workIds,
        rankings,
        completedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
}
