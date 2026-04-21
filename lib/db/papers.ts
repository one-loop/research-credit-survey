import type { Work, Author } from "@/lib/types"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

/** Raw author object as stored in papers.authors JSONB (from PNAS/PLOS JSONL) */
type PaperAuthor = {
    id?: string
    author_id: string
    initials?: string
    initials_anonymized?: string
    contributions?: string[]
    corresponding?: boolean
    name?: string
    name_anonymized?: string
    top100_institution?: boolean | number | string
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
    experiment_eligibility?: string[] | null
    created_at?: string
    /** Total survey exposures (increments on any experiment completion that included this work). */
    work_exposure?: number | null
}

type ExperimentType = "A" | "B" | "C"

function readString(obj: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = obj[key]
        if (typeof value === "string" && value.trim().length > 0) return value.trim()
    }
    return undefined
}

function readBoolean(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
    for (const key of keys) {
        const value = obj[key]
        if (typeof value === "boolean") return value
        if (typeof value === "number") return value === 1
        if (typeof value === "string") {
            const v = value.trim().toLowerCase()
            if (v === "true" || v === "1" || v === "yes") return true
            if (v === "false" || v === "0" || v === "no") return false
        }
    }
    return undefined
}

function initialsFromName(name: string | undefined): string | undefined {
    if (!name) return undefined
    const tokens = name
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
    if (!tokens.length) return undefined
    return tokens.map((t) => `${t[0]?.toUpperCase() ?? ""}.`).join("")
}

function mapPaperToWork(paper: PaperRow, isOwnWork = false): Work {
    const authors: Author[] = (paper.authors ?? []).map((a, position) => {
        const raw = a as Record<string, unknown>
        const anonymizedInitials = readString(raw, ["initials_anonymized", "initialsAnonymized"])
        const anonymizedName = readString(raw, ["name_anonymized", "nameAnonymized"])
        return {
            id: readString(raw, ["id", "author_id", "authorId"]) ?? String(position),
            // Never expose true initials in respondent-facing tasks.
            initials: (anonymizedInitials ?? initialsFromName(anonymizedName) ?? "?").trim(),
            contributions: Array.isArray(a.contributions) ? a.contributions : [],
            is_corresponding: readBoolean(raw, ["corresponding", "is_corresponding", "isCorresponding"]) ?? false,
            name: anonymizedName,
            gender: readString(raw, ["gender", "sex"]),
            race: readString(raw, ["race", "ethnicity"]),
            country_of_origin: readString(raw, ["country_of_origin", "country_or_region", "country"]),
            academic_age: typeof a.academic_age === "number" ? a.academic_age : undefined,
            h_index: typeof a.h_index === "number" ? a.h_index : undefined,
            top100_institution:
                readBoolean(raw, ["top100_institution", "top_100_institution", "top100Institution"]) ?? false,
            first_institution_name:
                Array.isArray(a.institutions) &&
                typeof a.institutions[0]?.institution_name === "string"
                    ? a.institutions[0].institution_name
                    : undefined,
        }
    })
    const displayName =
        paper.topic ?? paper.journal ?? paper.work_id
    return {
        work_id: paper.work_id,
        display_name: displayName,
        field: paper.field ?? undefined,
        domain: paper.domain ?? undefined,
        journal: paper.journal ?? undefined,
        publication_date: paper.publication_date ?? undefined,
        corresponding_email: paper.corresponding_email ?? undefined,
        experiment_eligibility: Array.isArray(paper.experiment_eligibility)
            ? paper.experiment_eligibility.filter((value): value is string => typeof value === "string")
            : undefined,
        authors,
        ...(isOwnWork && { isOwnWork: true }),
    }
}

const PAPER_COLUMNS =
    "work_id,publication_date,journal,topic,subfield,field,domain,corresponding_email,authors,experiment_eligibility,work_exposure"

function isExperimentEligible(paper: PaperRow, experimentType: ExperimentType): boolean {
    const eligibility = paper.experiment_eligibility
    if (!Array.isArray(eligibility) || eligibility.length === 0) return experimentType === "A"
    return eligibility.some((value) => value === experimentType)
}

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
        domain?: string
        excludeWorkIds: string[]
        limit: number
    }
): Promise<PaperRow[]> {
    const { domain, excludeWorkIds, limit } = opts
    if (!isSupabaseConfigured()) return []
    try {
        const supabase = getSupabase()
        let query = supabase
            .from("papers")
            .select(PAPER_COLUMNS)
            .limit(limit)

        if (domain) query = query.eq("domain", domain)
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
 * Prefer previously shown papers (higher work_exposure), while enforcing under-cap.
 * This supports "4 random from same domain, prioritized by being shown before."
 */
function orderPapersForFillers(rows: PaperRow[]): PaperRow[] {
    const eligible = rows.filter((p) => workExposureValue(p) < 3)
    const highExposure = eligible
        .filter((p) => workExposureValue(p) > 1)
        .sort((a, b) => workExposureValue(b) - workExposureValue(a))
    const lowExposure = shuffle(eligible.filter((p) => workExposureValue(p) <= 1))
    return [...highExposure, ...lowExposure]
}

async function getExperimentPapersPrioritized(
    authorId: string | undefined,
    worksPer: number,
    experimentType: ExperimentType
): Promise<Work[]> {
    const selected: Work[] = []
    const selectedIds = new Set<string>()

    if (authorId) {
        const ownPaper = await getPaperByAuthorIdRow(authorId)
        if (ownPaper) {
            if (!isExperimentEligible(ownPaper, experimentType)) {
                return []
            }
            const ownWork = mapPaperToWork(ownPaper, true)
            selected.push(ownWork)
            selectedIds.add(ownPaper.work_id)
        }
    }

    let remaining = worksPer - selected.length
    if (remaining <= 0) return selected

    const domain = selected[0]?.domain
    const domainPool = await getPapersPool({
        domain,
        excludeWorkIds: Array.from(selectedIds),
        limit: 500,
    })

    const orderedInDomain = orderPapersForFillers(domainPool)

    for (const row of orderedInDomain) {
        if (remaining <= 0) break
        if (selectedIds.has(row.work_id)) continue
        if (!isExperimentEligible(row, experimentType)) continue
        selected.push(mapPaperToWork(row))
        selectedIds.add(row.work_id)
        remaining -= 1
    }

    if (remaining <= 0) return selected

    const globalPool = await getPapersPool({
        excludeWorkIds: Array.from(selectedIds),
        limit: 800,
    })
    const orderedGlobal = orderPapersForFillers(globalPool)

    for (const row of orderedGlobal) {
        if (remaining <= 0) break
        if (selectedIds.has(row.work_id)) continue
        if (!isExperimentEligible(row, experimentType)) continue
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
    const row = await getPaperByAuthorIdRow(authorId)
    if (!row) return null
    return mapPaperToWork(row, true)
}

async function getPaperByAuthorIdRow(authorId: string): Promise<PaperRow | null> {
    if (!isSupabaseConfigured()) return null
    try {
        const supabase = getSupabase()
        const start = Date.now()
        // Support both legacy `author_id` and new `id` author key shapes.
        const lookups = [`[{"id":"${authorId}"}]`, `[{"author_id":"${authorId}"}]`]
        let data: unknown = null
        let error: { message?: string } | null = null
        for (const pattern of lookups) {
            const result = await supabase
                .from("papers")
                .select(PAPER_COLUMNS)
                .filter("authors", "cs", pattern)
                .order("publication_date", { ascending: false })
                .limit(1)
                .maybeSingle()
            if (result.data) {
                data = result.data
                error = null
                break
            }
            error = result.error
        }

        console.log("[papers] getPaperByAuthorId took", Date.now() - start, "ms", "| error:", error?.message ?? "none")
        if (error) return null
        if (!data) return null
        return data as PaperRow
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
    // Use one consistent selector across experiments A/C:
    // own paper + same-domain fillers prioritized by prior exposure.
    return getExperimentPapersPrioritized(authorId, worksPer, experimentType)
}

