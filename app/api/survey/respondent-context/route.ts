import { NextRequest, NextResponse } from "next/server"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import { worksPool } from "@/lib/mockData"
import { getParticipantAuthorId } from "@/lib/survey/participant"

export async function GET(request: NextRequest) {
    const authorId = getParticipantAuthorId(request)
    if (!authorId) {
        return NextResponse.json({ journal: null, domain: null })
    }

    if (isSupabaseConfigured()) {
        const supabase = getSupabase()
        const escapedAuthorId = authorId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        const lookupPatterns = [
            `[{"id":"${escapedAuthorId}"}]`,
            `[{"author_id":"${escapedAuthorId}"}]`
        ]

        let combinedData: any[] = []
        try {
            const results = await Promise.all(
                lookupPatterns.map((pattern) =>
                    supabase
                        .from("papers")
                        .select("work_id,journal,domain,publication_date,authors")
                        .eq("contributions_complete", true)
                        .filter("authors", "cs", pattern)
                        .order("publication_date", { ascending: false })
                        .limit(10)
                )
            )

            for (const { data, error } of results) {
                if (data) {
                    combinedData = combinedData.concat(data)
                }
            }
        } catch (err) {
            console.error("[respondent-context] database query error:", err)
        }

        if (combinedData.length > 0) {
            // De-duplicate by work_id
            const uniqueRows = Array.from(new Map(combinedData.map((row) => [row.work_id, row])).values())

            // Sort by publication_date descending
            uniqueRows.sort((a, b) => {
                const ad = a.publication_date ?? ""
                const bd = b.publication_date ?? ""
                return bd.localeCompare(ad)
            })

            // Find first paper where the participant is marked as corresponding
            const own =
                uniqueRows.find((row) =>
                    Array.isArray(row.authors) &&
                    row.authors.some((a: any) => {
                        const id = (typeof a.id === "string" ? a.id : typeof a.author_id === "string" ? a.author_id : typeof a.authorId === "string" ? a.authorId : "").trim()
                        const corresponding = a.corresponding === true || a.is_corresponding === true || a.isCorresponding === true
                        return id === authorId && corresponding
                    })
                ) ?? uniqueRows[0]

            return NextResponse.json({
                journal: own.journal ?? null,
                domain: own.domain ?? null,
            })
        }
    }

    const own = worksPool.find((w) => w.authors.some((a) => a.id === authorId))
    return NextResponse.json({
        journal: own?.journal ?? null,
        domain: own?.domain ?? null,
    })
}

