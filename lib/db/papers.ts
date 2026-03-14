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
}

function mapPaperToWork(paper: PaperRow, isOwnWork = false): Work {
    const authors: Author[] = (paper.authors ?? []).map((a, position) => ({
        id: a.author_id ?? String(position),
        initials: a.initials ?? "?",
        contributions: Array.isArray(a.contributions) ? a.contributions : [],
        is_corresponding: Boolean(a.corresponding),
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

const PAPER_COLUMNS = "work_id,publication_date,journal,topic,subfield,field,domain,corresponding_email,authors"

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
    worksPer: number
): Promise<Work[]> {
    if (!isSupabaseConfigured()) return []
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

