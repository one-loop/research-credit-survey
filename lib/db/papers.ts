import type { Work, Author } from "@/lib/types"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

/** Raw author object as stored in papers.authors JSONB (from PNAS/PLOS JSONL) */
type PaperAuthor = {
    author_id: string
    initials?: string
    contributions?: string[]
    corresponding?: boolean
    name?: string
    orcid?: string
    academic_age?: number
    h_index?: number
    institutions?: Array<{
        institution_id?: string
        institution_name?: string | null
    }>
    [key: string]: unknown
}

/** Row from Supabase papers table */
export type PaperRow = {
    work_id: string
    publication_date: string | null
    journal: string | null
    topic: string | null
    subfield: string | null
    field: string | null
    domain: string | null
    corresponding_email: string | null
    authors: PaperAuthor[] | null
    created_at?: string
    /** Total survey exposures (increments on any experiment completion that included this work). */
    work_exposure?: number | null
}

type ExperimentType = "A" | "B" | "C"

function mapPaperToWork(paper: PaperRow, isOwnWork = false): Work {
    const authors: Author[] = (paper.authors ?? []).map((a, position) => ({
        id: a.author_id ?? String(position),
        initials: a.initials ?? "?",
        contributions: Array.isArray(a.contributions) ? a.contributions : [],
        is_corresponding: Boolean(a.corresponding),
        name: typeof a.name === "string" ? a.name : undefined,
        academic_age: typeof a.academic_age === "number" ? a.academic_age : undefined,
        h_index: typeof a.h_index === "number" ? a.h_index : undefined,
        first_institution_name:
            Array.isArray(a.institutions) &&
            typeof a.institutions[0]?.institution_name === "string"
                ? a.institutions[0].institution_name
                : undefined,
    }))
    const displayName =
        paper.topic ?? paper.journal ?? paper.work_id
    return {
        work_id: paper.work_id,
        display_name: displayName,
        field: paper.field ?? undefined,
        journal: paper.journal ?? undefined,
        publication_date: paper.publication_date ?? undefined,
        corresponding_email: paper.corresponding_email ?? undefined,
        authors,
        ...(isOwnWork && { isOwnWork: true }),
    }
}

const PAPER_COLUMNS =
    "work_id,publication_date,journal,topic,subfield,field,domain,corresponding_email,authors,work_exposure"

function shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

async function getPapersPool(
    opts: {
        field?: string
        excludeWorkIds: string[]
        limit: number
    }
): Promise<PaperRow[]> {
    const { field, excludeWorkIds, limit } = opts
    if (!isSupabaseConfigured()) return []
    try {
        const supabase = getSupabase()
        let query = supabase
            .from("papers")
            .select(PAPER_COLUMNS)
            .limit(limit)

        if (field) query = query.eq("field", field)
        if (excludeWorkIds.length > 0) {
            const escapedIds = excludeWorkIds.map((id) => `"${id.replace(/"/g, '\\"')}"`)
            query = query.not("work_id", "in", `(${escapedIds.join(",")})`)
        }

        const { data, error } = await query
        if (error || !data?.length) return []
        return data as PaperRow[]
    } catch {
        return []
    }
}

function workExposureValue(p: PaperRow): number {
    const v = p.work_exposure
    if (typeof v !== "number" || Number.isNaN(v)) return 0
    return v
}

/**
 * For Experiment A (after own paper): only papers with DB work_exposure < 3 and A-session count < 3.
 * Prefer work_exposure > 1, highest first; then exposure ≤ 1, prioritizing any prior A appearances (shuffled within tier).
 */
function orderPapersForExperimentAFillers(
    rows: PaperRow[],
    aCountByWorkId: Map<string, number>
): PaperRow[] {
    const eligible = rows.filter((p) => {
        const ex = workExposureValue(p)
        const ac = aCountByWorkId.get(p.work_id) ?? 0
        return ex < 3 && ac < 3
    })

    const highExposure = eligible
        .filter((p) => workExposureValue(p) > 1)
        .sort((a, b) => workExposureValue(b) - workExposureValue(a))

    const low = eligible.filter((p) => workExposureValue(p) <= 1)
    const lowWithA = shuffle(low.filter((p) => (aCountByWorkId.get(p.work_id) ?? 0) > 0))
    const lowNew = shuffle(low.filter((p) => (aCountByWorkId.get(p.work_id) ?? 0) === 0))

    return [...highExposure, ...lowWithA, ...lowNew]
}

async function getExperimentAResponseCounts(workIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (!isSupabaseConfigured() || workIds.length === 0) return counts

    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("work_ids")
            .eq("experiment_type", "A")
            .overlaps("work_ids", workIds)

        if (error || !data?.length) return counts

        const workIdSet = new Set(workIds)
        for (const row of data as Array<{ work_ids: string[] | null }>) {
            for (const workId of row.work_ids ?? []) {
                if (!workIdSet.has(workId)) continue
                counts.set(workId, (counts.get(workId) ?? 0) + 1)
            }
        }
        return counts
    } catch {
        return counts
    }
}

async function getExperimentAPapersPrioritized(
    authorId: string | undefined,
    worksPer: number
): Promise<Work[]> {
    const selected: Work[] = []
    const selectedIds = new Set<string>()

    if (authorId) {
        const ownWork = await getPaperByAuthorId(authorId)
        if (ownWork) {
            selected.push(ownWork)
            selectedIds.add(ownWork.work_id)
        }
    }

    let remaining = worksPer - selected.length
    if (remaining <= 0) return selected

    const field = selected[0]?.field
    const fieldPool = await getPapersPool({
        field,
        excludeWorkIds: Array.from(selectedIds),
        limit: 500,
    })

    const fieldPoolIds = fieldPool.map((p) => p.work_id)
    const fieldCounts = await getExperimentAResponseCounts(fieldPoolIds)
    const orderedInField = orderPapersForExperimentAFillers(fieldPool, fieldCounts)

    for (const row of orderedInField) {
        if (remaining <= 0) break
        if (selectedIds.has(row.work_id)) continue
        selected.push(mapPaperToWork(row))
        selectedIds.add(row.work_id)
        remaining -= 1
    }

    if (remaining <= 0) return selected

    const globalPool = await getPapersPool({
        excludeWorkIds: Array.from(selectedIds),
        limit: 800,
    })
    const globalPoolIds = globalPool.map((p) => p.work_id)
    const globalCounts = await getExperimentAResponseCounts(globalPoolIds)
    const orderedGlobal = orderPapersForExperimentAFillers(globalPool, globalCounts)

    for (const row of orderedGlobal) {
        if (remaining <= 0) break
        if (selectedIds.has(row.work_id)) continue
        selected.push(mapPaperToWork(row))
        selectedIds.add(row.work_id)
        remaining -= 1
    }

    return selected
}

/**
 * Find one paper where authors (JSONB) contains an author with the given author_id.
 * Own paper is always returned regardless of work_exposure (per survey design).
 */
export async function getPaperByAuthorId(authorId: string): Promise<Work | null> {
    if (!isSupabaseConfigured()) return null
    try {
        const supabase = getSupabase()
        const start = Date.now()
        const { data, error } = await supabase
            .from("papers")
            .select(PAPER_COLUMNS)
            .contains("authors", [{ author_id: authorId }])
            .limit(1)
            .maybeSingle()

        console.log("[papers] getPaperByAuthorId took", Date.now() - start, "ms", "| error:", error?.message ?? "none")
        if (error) return null
        if (!data) return null
        return mapPaperToWork(data as PaperRow, true)
    } catch {
        return null
    }
}

/**
 * Fetch papers from the same field with work_exposure < 3, excluding one work_id.
 * Uses work_exposure column in DB (no file). Limit kept small for speed.
 */
export async function getPapersByField(
    field: string,
    excludeWorkId: string,
    limit: number
): Promise<Work[]> {
    if (!isSupabaseConfigured()) return []
    try {
        const supabase = getSupabase()
        const start = Date.now()
        const { data, error } = await supabase
            .from("papers")
            .select(PAPER_COLUMNS)
            .eq("field", field)
            .neq("work_id", excludeWorkId)
            .or("work_exposure.is.null,work_exposure.lt.3")
            .limit(limit)

        console.log("[papers] getPapersByField took", Date.now() - start, "ms", "| error:", error?.message ?? "none", "| rows:", data?.length ?? 0)
        if (error) return []
        if (!data?.length) return []
        return (data as PaperRow[]).map((row) => mapPaperToWork(row))
    } catch {
        return []
    }
}

/**
 * When no authorId provided, get papers with work_exposure < 3 for sampling.
 */
export async function getPapersSample(limit: number): Promise<Work[]> {
    if (!isSupabaseConfigured()) return []
    try {
        const supabase = getSupabase()
        const start = Date.now()
        const { data, error } = await supabase
            .from("papers")
            .select(PAPER_COLUMNS)
            .or("work_exposure.is.null,work_exposure.lt.3")
            .limit(limit)
            .order("created_at", { ascending: false })

        console.log("[papers] getPapersSample took", Date.now() - start, "ms", "| error:", error?.message ?? "none", "| rows:", data?.length ?? 0)
        if (error) return []
        if (!data?.length) return []
        return (data as PaperRow[]).map((row) => mapPaperToWork(row))
    } catch {
        return []
    }
}

/**
 * Increment work_exposure by 1 for each work_id in the list (e.g. after survey completion).
 * Requires DB function: increment_work_exposure(work_ids text[])
 */
export async function incrementWorkExposure(workIds: string[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !workIds.length) return false
    try {
        const supabase = getSupabase()
        const start = Date.now()
        const { error } = await supabase.rpc("increment_work_exposure", { work_ids: workIds })
        console.log("[papers] incrementWorkExposure took", Date.now() - start, "ms", "| error:", error?.message ?? "none")
        return !error
    } catch {
        return false
    }
}

/**
 * Single RPC to fetch Experiment A papers (own paper + same-field under-cap papers).
 * Wraps the get_experiment_papers(author_id, works_per) database function.
 */
export async function getExperimentPapers(
    authorId: string | undefined,
    worksPer: number,
    experimentType: ExperimentType = "A"
): Promise<Work[]> {
    if (!isSupabaseConfigured()) return []
    if (experimentType === "A") {
        return getExperimentAPapersPrioritized(authorId, worksPer)
    }
    try {
        const supabase = getSupabase()
        const start = Date.now()
        const { data, error } = await supabase.rpc("get_experiment_papers", {
            author_id: authorId ?? null,
            works_per: worksPer,
        })
        const duration = Date.now() - start
        console.log(
            "[papers] getExperimentPapers took",
            duration,
            "ms",
            "| error:",
            error?.message ?? "none",
            "| rows:",
            data?.length ?? 0
        )
        if (error || !data?.length) return []
        return (data as PaperRow[]).map((row) => {
            const isOwnWork =
                !!authorId &&
                Array.isArray((row as any).authors) &&
                (row as any).authors.some(
                    (author: PaperAuthor) => author.author_id === authorId
                )

            return mapPaperToWork(row, isOwnWork)
        })
    } catch (err) {
        console.error(
            "[papers] getExperimentPapers exception:",
            err instanceof Error ? err.message : String(err)
        )
        return []
    }
}

