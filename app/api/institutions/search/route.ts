import { NextRequest, NextResponse } from "next/server"
import { searchInstitutions } from "@/lib/db/institutionSearch"
import { isSupabaseConfigured } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim()
    if (q.length < 2) {
        return NextResponse.json({ items: [] })
    }
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ items: [] })
    }

    const items = await searchInstitutions(q, 12)
    const res = NextResponse.json({ items })
    res.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400")
    return res
}
