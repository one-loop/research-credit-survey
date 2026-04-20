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

    // Preferred schema: display_name
    const trySnakeCase = await supabase
        .from("institutions")
        .select("id,display_name")
        .ilike("display_name", `%${q}%`)
        .limit(limit)

    let rows: InstitutionRow[] | null = trySnakeCase.data as InstitutionRow[] | null
    let error = trySnakeCase.error

    // Backward-compat schema with a spaced column name: "display name"
    if (error) {
        const trySpaced = await supabase
            .from("institutions")
            .select('id,"display name"')
            .ilike("display name", `%${q}%`)
            .limit(limit)
        rows = trySpaced.data as InstitutionRow[] | null
        error = trySpaced.error
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

