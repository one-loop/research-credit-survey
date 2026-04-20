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

    const items = (rows ?? [])
        .map((r) => ({
            id: String(r.id ?? r.display_name ?? r["display name"] ?? ""),
            label: r.display_name ?? r["display name"] ?? "",
        }))
        .filter((x) => x.id.length > 0 && x.label.length > 0)

    return NextResponse.json({ items })
}

