import type { Work, Author } from "@/lib/types"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"
import { isExperimentEligible as paperIsExperimentEligible } from "@/lib/survey/experimentEligibility"
import { isInRespondentScope, shouldExcludeBySeenRules, type SeenWorkStats } from "@/lib/survey/poolEligibility"
import {
    filterRowsToRespondentScope,
    mergeRespondentScope,
    pickRespondentScopeFromOwnPapers,
    respondentScopeIsComplete,
    type RespondentPaperScope,
} from "@/lib/survey/respondentPaperScope"
import { selectNextOwnWorkId } from "@/lib/survey/queueSelection"
import {
    buildAccuracyDistributionStats,
    type AccuracyDistributionStats,
} from "@/lib/survey/accuracyDistribution"
import {
    buildInstitutionLeaderboard,
    type InstitutionLeaderboardResult,
} from "@/lib/survey/institutionLeaderboard"
import {
    averageRankingAccuracy,
    rankingAccuracyForWork,
    type AuthorForRankingAccuracy,
} from "@/lib/survey/rankingAccuracy"

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
    contributions_complete?: boolean | null
    created_at?: string
    /** Total survey exposures (increments on any experiment completion that included this work). */
    work_exposure?: number | null
}

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
        journal?: string
        scope?: RespondentPaperScope
        excludeWorkIds: string[]
        limit: number
        experimentType: ExperimentType
    }
): Promise<PaperRow[]> {
    const { domain, journal, excludeWorkIds, limit, experimentType } = opts
    const scope: RespondentPaperScope = opts.scope ?? { domain, journal }
    if (!isSupabaseConfigured()) return []
    try {
        const supabase = getSupabase()
        let query = supabase
            .from("papers")
            .select(PAPER_COLUMNS)
            .eq("contributions_complete", true)
            .limit(limit)

        if (scope.domain) query = query.eq("domain", scope.domain)
        if (scope.journal) query = query.eq("journal", scope.journal)
        if (excludeWorkIds.length > 0) {
            const escapedIds = excludeWorkIds.map((id) => `"${id.replace(/"/g, '\\"')}"`)
            query = query.not("work_id", "in", `(${escapedIds.join(",")})`)
        }
        if (experimentType === "B" || experimentType === "C") {
            query = query.contains("experiment_eligibility", [experimentType])
        }

        const { data, error } = await query
        if (error || !data?.length) return []
        return (data as PaperRow[]).filter(
            (row) =>
                paperIsExperimentEligible(row.experiment_eligibility, experimentType) &&
                isInRespondentScope(row, scope)
        )
    } catch {
        return []
    }
}

function filterWorksToRespondentScope(works: Work[], scope: RespondentPaperScope): Work[] {
    if (!scope.domain && !scope.journal) return works
    return works.filter((work) => isInRespondentScope(work, scope))
}

function workExposureValue(p: PaperRow): number {
    const v = p.work_exposure
    if (typeof v !== "number" || Number.isNaN(v)) return 0
    return v
}

/**
 * Prefer previously shown papers (higher work_exposure), while enforcing under-cap.
 * This supports selecting fillers from the same domain and journal, while
 * preventing over-exposed papers from being shown again.
 */
function orderPapersForFillers(rows: PaperRow[]): PaperRow[] {
    const eligible = rows.filter((p) => workExposureValue(p) < 3)
    const highExposure = eligible
        .filter((p) => workExposureValue(p) > 1)
        .sort((a, b) => workExposureValue(b) - workExposureValue(a))
    const lowExposure = shuffle(eligible.filter((p) => workExposureValue(p) <= 1))
    return [...highExposure, ...lowExposure]
}

async function getSeenWorkStatsForPool(
    workIds: string[],
    authorId: string | undefined
): Promise<Map<string, SeenWorkStats>> {
    const byWork = new Map<string, SeenWorkStats>()
    if (!isSupabaseConfigured() || workIds.length === 0) return byWork
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("author_id,work_ids,experiment_type")
            .overlaps("work_ids", workIds)

        if (error || !data?.length) return byWork

        for (const row of data as Array<{
            author_id: string | null
            work_ids: string[] | null
            experiment_type: ExperimentType | null
        }>) {
            const responseWorkIds = Array.isArray(row.work_ids) ? row.work_ids : []
            for (const workId of responseWorkIds) {
                if (!workIds.includes(workId)) continue
                let stats = byWork.get(workId)
                if (!stats) {
                    stats = {
                        seenByRespondent: false,
                        uniqueRespondents: new Set<string>(),
                        experimentsSeenIn: new Set<ExperimentType>(),
                    }
                    byWork.set(workId, stats)
                }
                if (authorId && row.author_id === authorId) {
                    stats.seenByRespondent = true
                }
                if (typeof row.author_id === "string" && row.author_id.length > 0) {
                    stats.uniqueRespondents.add(row.author_id)
                }
                if (row.experiment_type === "A" || row.experiment_type === "B" || row.experiment_type === "C") {
                    stats.experimentsSeenIn.add(row.experiment_type)
                }
            }
        }
        return byWork
    } catch {
        return byWork
    }
}

/**
 * Queue index to store on the next completion: most recent response's queue_index + 1,
 * or 0 if the respondent has no prior responses in this experiment.
 */
export async function getNextQueueIndexForSave(
    authorId: string | undefined,
    experimentType: ExperimentType | null | undefined
): Promise<number> {
    if (!authorId || !experimentType || !isSupabaseConfigured()) return 0
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("queue_index")
            .eq("author_id", authorId)
            .eq("experiment_type", experimentType)
            .order("created_at", { ascending: false })
            .limit(1)

        if (error || !data?.length) return 0

        const latest = (data[0] as { queue_index?: number | null }).queue_index
        if (typeof latest === "number" && Number.isFinite(latest) && latest >= 0) {
            return Math.floor(latest) + 1
        }
        return 0
    } catch {
        return 0
    }
}

/** Whether this respondent has completed at least one batch in this experiment. */
export async function getExperimentCompletionStatus(
    authorId: string | undefined,
    experimentType: ExperimentType
): Promise<{ hasCompleted: boolean; latestQueueIndex: number | null }> {
    if (!authorId || !isSupabaseConfigured()) {
        return { hasCompleted: false, latestQueueIndex: null }
    }
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("queue_index")
            .eq("author_id", authorId)
            .eq("experiment_type", experimentType)
            .order("created_at", { ascending: false })
            .limit(1)

        if (error || !data?.length) {
            return { hasCompleted: false, latestQueueIndex: null }
        }

        const latest = (data[0] as { queue_index?: number | null }).queue_index
        if (typeof latest === "number" && Number.isFinite(latest) && latest >= 0) {
            return { hasCompleted: true, latestQueueIndex: Math.floor(latest) }
        }
        return { hasCompleted: true, latestQueueIndex: 0 }
    } catch {
        return { hasCompleted: false, latestQueueIndex: null }
    }
}

/** Most recent completion for this respondent across any experiment (for participant entry links). */
export async function getRespondentLatestCompletion(
    authorId: string | undefined
): Promise<{
    hasCompleted: boolean
    experimentType: ExperimentType | null
    latestQueueIndex: number | null
}> {
    if (!authorId || !isSupabaseConfigured()) {
        return { hasCompleted: false, experimentType: null, latestQueueIndex: null }
    }
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("queue_index,experiment_type")
            .eq("author_id", authorId)
            .order("created_at", { ascending: false })
            .limit(1)

        if (error || !data?.length) {
            return { hasCompleted: false, experimentType: null, latestQueueIndex: null }
        }

        const row = data[0] as {
            queue_index?: number | null
            experiment_type?: string | null
        }
        const experimentType =
            row.experiment_type === "A" || row.experiment_type === "B" || row.experiment_type === "C"
                ? row.experiment_type
                : null
        const latest = row.queue_index
        const latestQueueIndex =
            typeof latest === "number" && Number.isFinite(latest) && latest >= 0
                ? Math.floor(latest)
                : 0
        return {
            hasCompleted: true,
            experimentType,
            latestQueueIndex,
        }
    } catch {
        return { hasCompleted: false, experimentType: null, latestQueueIndex: null }
    }
}

function authorsForRankingAccuracy(paper: PaperRow): AuthorForRankingAccuracy[] {
    return (paper.authors ?? []).map((a, position) => {
        const raw = a as Record<string, unknown>
        return {
            id: readString(raw, ["id", "author_id", "authorId"]) ?? String(position),
            equal_contrib:
                readBoolean(raw, ["equal_contrib", "equalContrib", "equal_contribution"]) ?? false,
        }
    })
}

export type QueueAccuracyResult = {
    averageAccuracy: number | null
    workAccuracies: Record<string, number>
}

/** Compute queue accuracy from rankings and canonical paper author order. */
export async function computeQueueAccuracyFromRankings(
    workIds: string[],
    rankings: Record<string, string[]>
): Promise<QueueAccuracyResult> {
    const workAccuracies: Record<string, number> = {}
    const perWork: Array<number | null> = []

    for (const workId of workIds) {
        const respondentRanking = rankings[workId]
        if (!Array.isArray(respondentRanking) || respondentRanking.length === 0) {
            perWork.push(null)
            continue
        }
        const paper = await getPaperRowByWorkId(workId)
        if (!paper) {
            perWork.push(null)
            continue
        }
        const accuracy = rankingAccuracyForWork(
            authorsForRankingAccuracy(paper),
            respondentRanking
        )
        if (typeof accuracy === "number" && Number.isFinite(accuracy)) {
            workAccuracies[workId] = accuracy
        }
        perWork.push(accuracy)
    }

    return {
        averageAccuracy: averageRankingAccuracy(perWork),
        workAccuracies,
    }
}

export type RespondentAccuracySummary = {
    /** Accuracy for the requested queue (this block of 5). */
    queueAccuracy: number | null
    /** Mean of stored queue accuracies across all completed queues in this experiment. */
    respondentAverageAccuracy: number | null
    queuesCompleted: number
}

/**
 * Read stored accuracies for the thank-you screen. Recomputes only when a row
 * predates the accuracy columns (legacy responses).
 */
export async function getRespondentAccuracySummary(
    authorId: string | undefined,
    experimentType: ExperimentType,
    queueIndex: number
): Promise<RespondentAccuracySummary> {
    const empty: RespondentAccuracySummary = {
        queueAccuracy: null,
        respondentAverageAccuracy: null,
        queuesCompleted: 0,
    }
    if (!authorId || !isSupabaseConfigured()) return empty

    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("queue_index,average_accuracy")
            .eq("author_id", authorId)
            .eq("experiment_type", experimentType)
            .order("queue_index", { ascending: true })
            .order("created_at", { ascending: true })

        if (error || !data?.length) return empty

        const queueScores: number[] = []
        let queueAccuracy: number | null = null

        for (const raw of data) {
            const row = raw as {
                queue_index?: number | null
                average_accuracy?: number | null
            }
            const rowQueue =
                typeof row.queue_index === "number" && Number.isFinite(row.queue_index)
                    ? Math.floor(row.queue_index)
                    : 0

            const accuracy =
                typeof row.average_accuracy === "number" && Number.isFinite(row.average_accuracy)
                    ? row.average_accuracy
                    : null

            if (typeof accuracy === "number" && Number.isFinite(accuracy)) {
                queueScores.push(accuracy)
                if (rowQueue === queueIndex) {
                    queueAccuracy = accuracy
                }
            }
        }

        const respondentAverageAccuracy =
            queueScores.length > 0
                ? queueScores.reduce((sum, v) => sum + v, 0) / queueScores.length
                : null

        return {
            queueAccuracy,
            respondentAverageAccuracy,
            queuesCompleted: queueScores.length,
        }
    } catch {
        return empty
    }
}

/**
 * Distribution of stored queue-level accuracies for an experiment (one point per
 * completed block). Shown once at least one response exists in the experiment.
 */
export async function getAccuracyDistributionForExperiment(
    experimentType: ExperimentType,
    comparisonScore: number | null
): Promise<AccuracyDistributionStats> {
    const { getCachedExperimentAnalyticsRows } = await import("@/lib/db/experimentAnalytics")
    try {
        const rows = await getCachedExperimentAnalyticsRows(experimentType)
        const scores = rows.map((r) => r.averageAccuracy)
        return buildAccuracyDistributionStats(scores, comparisonScore)
    } catch {
        return buildAccuracyDistributionStats([], comparisonScore)
    }
}

/** Top institutions by mean block accuracy for this experiment. */
export async function getInstitutionLeaderboardForExperiment(
    authorId: string | undefined,
    experimentType: ExperimentType
): Promise<InstitutionLeaderboardResult> {
    const empty: InstitutionLeaderboardResult = {
        top10: [],
        respondent: null,
        respondentInstitutionKey: null,
    }
    const {
        getCachedExperimentAnalyticsRows,
        getRespondentInstitutionKeyForExperiment,
    } = await import("@/lib/db/experimentAnalytics")

    try {
        const [rows, respondentInstitutionKey] = await Promise.all([
            getCachedExperimentAnalyticsRows(experimentType),
            getRespondentInstitutionKeyForExperiment(authorId, experimentType),
        ])
        if (!rows.length) return empty
        return buildInstitutionLeaderboard(rows, respondentInstitutionKey)
    } catch {
        return empty
    }
}

/** Journal/domain from the respondent's first completed batch in this experiment. */
async function getInitialSubmissionScope(
    authorId: string,
    experimentType: ExperimentType
): Promise<{ domain?: string; journal?: string }> {
    if (!isSupabaseConfigured()) return {}
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("own_work,created_at,queue_index")
            .eq("author_id", authorId)
            .eq("experiment_type", experimentType)
            .order("queue_index", { ascending: true })
            .order("created_at", { ascending: true })
            .limit(1)

        if (error || !data?.length) return {}

        const first = data[0] as { own_work?: string | null }
        const ownWorkId =
            typeof first.own_work === "string" && first.own_work.trim().length > 0
                ? first.own_work.trim()
                : undefined
        if (!ownWorkId) return {}

        const paper = await getPaperRowByWorkId(ownWorkId)
        if (!paper) return {}
        return {
            domain: paper.domain ?? undefined,
            journal: paper.journal ?? undefined,
        }
    } catch {
        return {}
    }
}

async function getPaperRowByWorkId(workId: string): Promise<PaperRow | null> {
    if (!isSupabaseConfigured()) return null
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("papers")
            .select(PAPER_COLUMNS)
            .eq("work_id", workId)
            .maybeSingle()
        if (error || !data) return null
        return data as PaperRow
    } catch {
        return null
    }
}

async function getExperimentPapersPrioritized(
    authorId: string | undefined,
    worksPer: number,
    experimentType: ExperimentType,
    queueIndex: number
): Promise<Work[]> {
    const selected: Work[] = []
    const selectedIds = new Set<string>()
    let scope: RespondentPaperScope = {}
    const ownWorkIds = new Set<string>()

    if (authorId) {
        const allOwnPapers = await getCorrespondingOwnPapersByAuthorIdRows(authorId)
        for (const row of allOwnPapers) ownWorkIds.add(row.work_id)

        const fallbackScope = pickRespondentScopeFromOwnPapers(allOwnPapers)
        if (queueIndex > 0) {
            const initialScope = await getInitialSubmissionScope(authorId, experimentType)
            scope = mergeRespondentScope(
                {
                    domain: initialScope.domain,
                    journal: initialScope.journal,
                },
                fallbackScope
            )
        } else {
            scope = fallbackScope
        }

        if (!respondentScopeIsComplete(scope)) {
            return []
        }

        const ownPapers = filterRowsToRespondentScope(allOwnPapers, scope)

        const eligibleOwnPapers = ownPapers.filter((paper) =>
            paperIsExperimentEligible(paper.experiment_eligibility, experimentType)
        )
        if (experimentType === "B" && eligibleOwnPapers.length === 0) {
            return []
        }

        const shownOwnWorkIds = await getShownOwnWorkIdsForExperiment(authorId, experimentType, ownWorkIds)
        const nextOwnWorkId = selectNextOwnWorkId(
            eligibleOwnPapers.map((p) => p.work_id),
            shownOwnWorkIds
        )
        if (nextOwnWorkId) {
            const ownPaper = eligibleOwnPapers.find((p) => p.work_id === nextOwnWorkId)
            if (ownPaper) {
                const ownWork = mapPaperToWork(ownPaper, true)
                selected.push(ownWork)
                selectedIds.add(ownPaper.work_id)
            }
        }
    }

    let remaining = worksPer - selected.length
    if (remaining <= 0) {
        return filterWorksToRespondentScope(
            selected.filter((work) =>
                paperIsExperimentEligible(work.experiment_eligibility, experimentType)
            ),
            scope
        )
    }

    const strictPool = await getPapersPool({
        domain: scope.domain,
        journal: scope.journal,
        scope,
        excludeWorkIds: Array.from(new Set([...Array.from(selectedIds), ...Array.from(ownWorkIds)])),
        limit: 500,
        experimentType,
    })

    const seenStatsByWork = await getSeenWorkStatsForPool(
        strictPool.map((row) => row.work_id),
        authorId
    )
    const orderedStrict = orderPapersForFillers(strictPool)
    const ownWorkId = selected.find((w) => w.isOwnWork)?.work_id

    for (const row of orderedStrict) {
        if (remaining <= 0) break
        if (selectedIds.has(row.work_id)) continue
        if (!paperIsExperimentEligible(row.experiment_eligibility, experimentType)) continue
        if (!isInRespondentScope(row, scope)) continue
        if (
            shouldExcludeBySeenRules(row, seenStatsByWork.get(row.work_id), {
                ownWorkId,
                experimentType,
            })
        ) {
            continue
        }
        selected.push(mapPaperToWork(row))
        selectedIds.add(row.work_id)
        remaining -= 1
    }

    return filterWorksToRespondentScope(
        selected.filter((work) =>
            paperIsExperimentEligible(work.experiment_eligibility, experimentType)
        ),
        scope
    )
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
                .eq("contributions_complete", true)
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

async function getCorrespondingOwnPapersByAuthorIdRows(authorId: string): Promise<PaperRow[]> {
    if (!isSupabaseConfigured()) return []
    try {
        const supabase = getSupabase()
        const escapedAuthorId = authorId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        const lookups = [`[{"id":"${escapedAuthorId}"}]`, `[{"author_id":"${escapedAuthorId}"}]`]
        const all: PaperRow[] = []
        const seenIds = new Set<string>()
        for (const pattern of lookups) {
            const result = await supabase
                .from("papers")
                .select(PAPER_COLUMNS)
                .eq("contributions_complete", true)
                .filter("authors", "cs", pattern)
                .order("publication_date", { ascending: false })
            const rows = (result.data as PaperRow[] | null) ?? []
            for (const row of rows) {
                if (seenIds.has(row.work_id)) continue
                const authors = Array.isArray(row.authors) ? row.authors : []
                const isCorresponding = authors.some((a) => {
                    const raw = a as Record<string, unknown>
                    const id = readString(raw, ["id", "author_id", "authorId"])
                    if (id !== authorId) return false
                    return readBoolean(raw, ["corresponding", "is_corresponding", "isCorresponding"]) === true
                })
                if (!isCorresponding) continue
                seenIds.add(row.work_id)
                all.push(row)
            }
        }
        all.sort((a, b) => {
            const ad = a.publication_date ?? ""
            const bd = b.publication_date ?? ""
            return bd.localeCompare(ad)
        })
        return all
    } catch {
        return []
    }
}

async function getShownOwnWorkIdsForExperiment(
    authorId: string,
    experimentType: ExperimentType,
    ownWorkIds: Set<string>
): Promise<Set<string>> {
    const shown = new Set<string>()
    if (!isSupabaseConfigured() || ownWorkIds.size === 0) return shown
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("work_ids,own_work")
            .eq("author_id", authorId)
            .eq("experiment_type", experimentType)
        if (error || !data?.length) return shown
        for (const row of data as Array<{ work_ids: string[] | null; own_work: string | null }>) {
            if (typeof row.own_work === "string" && ownWorkIds.has(row.own_work)) {
                shown.add(row.own_work)
            }
            for (const workId of row.work_ids ?? []) {
                if (ownWorkIds.has(workId)) shown.add(workId)
            }
        }
        return shown
    } catch {
        return shown
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
            .eq("contributions_complete", true)
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
            .eq("contributions_complete", true)
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
    experimentType: ExperimentType = "A",
    queueIndex = 0
): Promise<Work[]> {
    if (!isSupabaseConfigured()) return []
    // Use one consistent selector across experiments:
    // own paper + same-domain-and-journal fillers prioritized by prior exposure.
    return getExperimentPapersPrioritized(authorId, worksPer, experimentType, queueIndex)
}

