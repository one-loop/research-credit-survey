export type InstitutionLeaderboardEntry = {
    rank: number
    institutionKey: string
    institutionName: string
    averageAccuracy: number
    responseCount: number
}

export type InstitutionLeaderboardResult = {
    top10: InstitutionLeaderboardEntry[]
    /** Set when the respondent's institution is outside the top 10. */
    respondent: InstitutionLeaderboardEntry | null
    /** For highlighting the respondent's row when they appear in the top 10. */
    respondentInstitutionKey: string | null
}

export type ResponseForLeaderboard = {
    averageAccuracy: number
    demographics: Record<string, unknown> | null
}

export function institutionKeyFromDemographics(
    demographics: Record<string, unknown> | null | undefined
): string | null {
    if (!demographics) return null
    const id =
        typeof demographics.institution_id === "string"
            ? demographics.institution_id.trim()
            : ""
    if (id) return `id:${id}`
    const name =
        typeof demographics.institution === "string" ? demographics.institution.trim() : ""
    if (name) return `name:${name.toLowerCase()}`
    return null
}

export function institutionNameFromDemographics(
    demographics: Record<string, unknown> | null | undefined
): string {
    if (!demographics) return "Unknown institution"
    const name =
        typeof demographics.institution === "string" ? demographics.institution.trim() : ""
    return name || "Unknown institution"
}

/**
 * Rank institutions by mean block accuracy (one score per completed queue).
 */
export function buildInstitutionLeaderboard(
    responses: ResponseForLeaderboard[],
    respondentInstitutionKey: string | null
): InstitutionLeaderboardResult {
    const groups = new Map<string, { name: string; scores: number[] }>()

    for (const row of responses) {
        if (!Number.isFinite(row.averageAccuracy)) continue
        const key = institutionKeyFromDemographics(row.demographics)
        if (!key) continue
        const name = institutionNameFromDemographics(row.demographics)
        const existing = groups.get(key)
        if (existing) {
            existing.scores.push(row.averageAccuracy)
        } else {
            groups.set(key, { name, scores: [row.averageAccuracy] })
        }
    }

    const ranked: InstitutionLeaderboardEntry[] = Array.from(groups.entries())
        .map(([key, { name, scores }]) => ({
            institutionKey: key,
            institutionName: name,
            averageAccuracy: scores.reduce((a, b) => a + b, 0) / scores.length,
            responseCount: scores.length,
            rank: 0,
        }))
        .sort((a, b) => {
            if (b.averageAccuracy !== a.averageAccuracy) {
                return b.averageAccuracy - a.averageAccuracy
            }
            return a.institutionName.localeCompare(b.institutionName)
        })
        .map((entry, index) => ({ ...entry, rank: index + 1 }))

    const top10 = ranked.slice(0, 10)
    const top10Keys = new Set(top10.map((e) => e.institutionKey))
    const respondent =
        respondentInstitutionKey && !top10Keys.has(respondentInstitutionKey)
            ? ranked.find((e) => e.institutionKey === respondentInstitutionKey) ?? null
            : null

    return {
        top10,
        respondent,
        respondentInstitutionKey: respondentInstitutionKey,
    }
}
