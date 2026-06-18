import { NextRequest, NextResponse } from "next/server"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

type InstitutionRow = {
    id?: string | number
    display_name?: string
    "display name"?: string
}

export async function GET(request: NextRequest) {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim()
    if (q.length < 2) {
        return NextResponse.json({ items: [] as Array<{ id: string; label: string }> })
    }
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ items: [] as Array<{ id: string; label: string }> })
    }

    const supabase = getSupabase()
    const limit = 12
    const qLower = q.toLocaleLowerCase()

    const attempts = [
        { select: "id,display_name", column: "display_name" },
        { select: "display_name", column: "display_name" },
        { select: 'id,"display name"', column: "display name" },
        { select: '"display name"', column: "display name" },
    ] as const

    let rows: InstitutionRow[] | null = null
    let error: { message?: string } | null = null

    for (const attempt of attempts) {
        const result = await supabase
            .from("institutions")
            .select(attempt.select)
            .ilike(attempt.column, `%${q}%`)
            .limit(limit)
        if (!result.error) {
            rows = result.data as InstitutionRow[] | null
            error = null
            break
        }
        error = result.error
    }

    if (error) {
        console.error("[institutions/search] query failed:", error.message)
        return NextResponse.json({ items: [] as Array<{ id: string; label: string }> })
    }

    const dedupedByLabel = new Map<string, { id: string; label: string }>()
    for (const row of rows ?? []) {
        const label = row.display_name ?? row["display name"] ?? ""
        const id = String(row.id ?? label)
        if (!label || !id) continue
        if (!dedupedByLabel.has(label)) {
            dedupedByLabel.set(label, { id, label })
        }
    }

    const items = Array.from(dedupedByLabel.values())
        .sort((a, b) => {
            const aLower = a.label.toLocaleLowerCase()
            const bLower = b.label.toLocaleLowerCase()
            const aStarts = aLower.startsWith(qLower)
            const bStarts = bLower.startsWith(qLower)
            if (aStarts !== bStarts) return aStarts ? -1 : 1
            const aPos = aLower.indexOf(qLower)
            const bPos = bLower.indexOf(qLower)
            if (aPos !== bPos) return aPos - bPos
            return aLower.localeCompare(bLower)
        })
        .slice(0, limit)

    return NextResponse.json({ items })
}

