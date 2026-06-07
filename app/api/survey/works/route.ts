import { NextRequest, NextResponse } from "next/server"
import { worksPool as mockWorksPool } from "@/lib/mockData"
import { getExperimentPapers } from "@/lib/db/papers"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import type { Work } from "@/lib/types"
import { getParticipantAuthorId } from "@/lib/survey/participant"
import { selectWorksOnePerAuthorBin } from "@/lib/survey/authorCountBins"
import { filterWorksForExperiment, workIsExperimentEligible } from "@/lib/survey/experimentEligibility"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"

const WORKS_PER_RESPONDENT = 5

function selectMockWorksByAuthorBins(
    ownWork: Work | undefined,
    pool: Work[],
    experimentType: ExperimentType
): Work[] {
    const workById = new Map(pool.map((work) => [work.work_id, work]))
    if (ownWork) workById.set(ownWork.work_id, ownWork)

    const candidates = pool
        .filter((work) => !ownWork || work.work_id !== ownWork.work_id)
        .map((work) => ({
            work_id: work.work_id,
            authorCount: work.authors.length,
        }))

    const ownCandidate = ownWork
        ? {
              work_id: ownWork.work_id,
              authorCount: ownWork.authors.length,
              isOwnWork: true as const,
          }
        : null

    const picked = selectWorksOnePerAuthorBin({
        candidates,
        ownWork: ownCandidate,
        isEligible: (work) => {
            const row = workById.get(work.work_id)
            return row ? workIsExperimentEligible(row, experimentType) : false
        },
    })

    return picked
        .map((work) => {
            const row = workById.get(work.work_id)
            if (!row) return null
            return work.isOwnWork ? { ...row, isOwnWork: true } : row
        })
        .filter((work): work is Work => work !== null)
        .slice(0, WORKS_PER_RESPONDENT)
}

export async function GET(request: NextRequest) {
    const authorId = getParticipantAuthorId(request)
    const requestedExperiment = request.nextUrl.searchParams.get("experimentType")
    const queueIndexRaw = Number(request.nextUrl.searchParams.get("queueIndex") ?? "0")
    const queueIndex = Number.isFinite(queueIndexRaw) && queueIndexRaw >= 0 ? Math.floor(queueIndexRaw) : 0
    const experimentType = requestedExperiment === "B" || requestedExperiment === "C" ? requestedExperiment : "A"
    const useSupabase = isSupabaseConfigured()

    let selected: Work[] = []
    let dataSource: "supabase" | "mock" = "mock"

    if (useSupabase) {
        const start = Date.now()
        selected = await getExperimentPapers(authorId, WORKS_PER_RESPONDENT, experimentType, queueIndex)
        const duration = Date.now() - start
        console.log("[survey/works] Supabase experiment papers took", duration, "ms", "| queue:", queueIndex)
        if (selected.length > 0) {
            dataSource = "supabase"
        }
    }

    if (selected.length === 0 || !useSupabase) {
        dataSource = "mock"
        const worksPool = mockWorksPool
        const findWorkByAuthorId = (id: string) =>
            worksPool.find((w) => w.authors.some((a) => a.id === id))
        const ownWorkRaw = authorId ? findWorkByAuthorId(authorId) : undefined
        const ownWork =
            ownWorkRaw && workIsExperimentEligible(ownWorkRaw, experimentType)
                ? ownWorkRaw
                : undefined
        const targetDomain = ownWork?.domain
        const targetJournal = ownWork?.journal
        const candidatePool = worksPool.filter((w) => {
            if (ownWork && w.work_id === ownWork.work_id) return false
            if (authorId && !targetJournal) return false
            if (targetDomain && w.domain !== targetDomain) return false
            if (targetJournal && w.journal !== targetJournal) return false
            if (!workIsExperimentEligible(w, experimentType)) return false
            return true
        })
        const pool =
            authorId && targetJournal
                ? candidatePool
                : authorId
                  ? []
                  : worksPool.filter(
                        (w) =>
                            (!ownWork || w.work_id !== ownWork.work_id) &&
                            workIsExperimentEligible(w, experimentType)
                    )
        selected = selectMockWorksByAuthorBins(ownWork, pool, experimentType)
    }

    selected = filterWorksForExperiment(selected, experimentType)

    if (experimentType === "B" && authorId && selected.length === 0) {
        return NextResponse.json(
            { error: "Experiment B is not eligible for this author." },
            { status: 403 }
        )
    }
    const res = NextResponse.json({
        works: selected,
        dataSource,
    })
    res.headers.set("X-Data-Source", dataSource)
    return res
}
