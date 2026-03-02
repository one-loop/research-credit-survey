import { NextRequest, NextResponse } from "next/server"
import { worksPool as mockWorksPool } from "@/lib/mockData"
import { getExperimentPapers } from "@/lib/db/papers"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import type { Work } from "@/lib/types"

const WORKS_PER_RESPONDENT = 5

function shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

export async function GET(request: NextRequest) {
    const authorId = request.nextUrl.searchParams.get("authorId") ?? undefined
    const useSupabase = isSupabaseConfigured()

    let selected: Work[] = []
    let dataSource: "supabase" | "mock" = "mock"

    if (useSupabase) {
        const start = Date.now()
        selected = await getExperimentPapers(authorId, WORKS_PER_RESPONDENT)
        const duration = Date.now() - start
        console.log("[survey/works] Supabase experiment papers took", duration, "ms")
        if (selected.length > 0) {
            dataSource = "supabase"
        }
    }

    if (selected.length === 0 || !useSupabase) {
        dataSource = "mock"
        const worksPool = mockWorksPool
        const findWorkByAuthorId = (id: string) =>
            worksPool.find((w) => w.authors.some((a) => a.id === id))
        let ownWork = authorId ? findWorkByAuthorId(authorId) : undefined
        if (ownWork) selected.push({ ...ownWork, isOwnWork: true })
        const targetField = ownWork?.field
        const candidatePool = worksPool.filter((w) => {
            if (ownWork && w.work_id === ownWork.work_id) return false
            if (targetField && w.field !== targetField) return false
            return true
        })
        const pool = targetField
            ? candidatePool
            : worksPool.filter((w) => !ownWork || w.work_id !== ownWork.work_id)
        const shuffled = shuffle(pool)
        for (const work of shuffled) {
            if (selected.length >= WORKS_PER_RESPONDENT) break
            if (!selected.some((s) => s.work_id === work.work_id)) selected.push(work)
        }
    }
    const res = NextResponse.json({
        works: selected,
        dataSource,
    })
    res.headers.set("X-Data-Source", dataSource)
    return res
}

