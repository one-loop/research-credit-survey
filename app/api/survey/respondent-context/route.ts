import { NextRequest, NextResponse } from "next/server"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import { worksPool } from "@/lib/mockData"

export async function GET(request: NextRequest) {
    const authorId = request.nextUrl.searchParams.get("authorId")
    if (!authorId) {
        return NextResponse.json({ error: "authorId is required" }, { status: 400 })
    }

    if (isSupabaseConfigured()) {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("papers")
            .select("journal,field,publication_date,authors")
            .filter("authors", "cs", `[{"id":"${authorId}"}]`)
            .order("publication_date", { ascending: false })
            .limit(10)

        if (error || !data?.length) return NextResponse.json({ journal: null, field: null })

        const own =
            data.find((row) =>
                Array.isArray((row as { authors?: unknown[] }).authors) &&
                (row as { authors: Array<{ id?: string; corresponding?: boolean }> }).authors.some(
                    (a) => a.id === authorId && a.corresponding === true
                )
            ) ?? data[0]

        return NextResponse.json({
            journal: (own as { journal?: string | null }).journal ?? null,
            field: (own as { field?: string | null }).field ?? null,
        })
    }

    const own = worksPool.find((w) => w.authors.some((a) => a.id === authorId))
    return NextResponse.json({
        journal: own?.journal ?? null,
        field: own?.field ?? null,
    })
}

