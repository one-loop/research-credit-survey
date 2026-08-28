import { NextRequest, NextResponse } from "next/server"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

type InstitutionRow = {
    id?: string | number
    display_name?: string
    "display name"?: string
}

type InstitutionItem = { id: string; label: string }

// In-memory cache for fast repeated queries
const memoryCache = new Map<string, InstitutionItem[]>()
const MAX_CACHE_SIZE = 1000

// Remember which query pattern works so we don't try failed columns repeatedly
let knownWorkingAttempt: { select: string; column: string } | null = null

export async function GET(request: NextRequest) {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim()
    if (q.length < 2) {
        return NextResponse.json(
            { items: [] as InstitutionItem[] },
            { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
        )
    }

    const qLower = q.toLocaleLowerCase()

    // Check memory cache first
    const cached = memoryCache.get(qLower)
    if (cached) {
        return NextResponse.json(
            { items: cached },
            { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
        )
    }

    if (!isSupabaseConfigured()) {
        return NextResponse.json({ items: [] as InstitutionItem[] })
    }

    const supabase = getSupabase()
    const limit = 15

    const attempts = knownWorkingAttempt
        ? [knownWorkingAttempt]
        : [
              { select: "display_name", column: "display_name" },
              { select: '"display name"', column: "display name" },
              { select: "id,display_name", column: "display_name" },
              { select: 'id,"display name"', column: "display name" },
          ]

    let rows: InstitutionRow[] | null = null
    let error: { message?: string } | null = null

    for (const attempt of attempts) {
        const result = await supabase
            .from("institutions")
            .select(attempt.select)
            .ilike(attempt.column, `%${q}%`)
            .limit(limit * 2)

        if (!result.error) {
            rows = result.data as InstitutionRow[] | null
            error = null
            knownWorkingAttempt = attempt
            break
        }
        error = result.error
    }

    if (error) {
        console.error("[institutions/search] query failed:", error.message)
        return NextResponse.json({ items: [] as InstitutionItem[] })
    }

    const dedupedByLabel = new Map<string, InstitutionItem>()
    for (const row of rows ?? []) {
        const label = (row.display_name ?? row["display name"] ?? "").trim()
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

    // Save to in-memory cache
    if (memoryCache.size >= MAX_CACHE_SIZE) {
        const firstKey = memoryCache.keys().next().value
        if (firstKey) memoryCache.delete(firstKey)
    }
    memoryCache.set(qLower, items)

    return NextResponse.json(
        { items },
        {
            headers: {
                "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
            },
        }
    )
}

