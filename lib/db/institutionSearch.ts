import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

export type InstitutionSearchItem = { id: string; label: string }

type InstitutionSearchConfig = {
    select: string
    column: "display_name" | "display name"
    hasId: boolean
}

const SEARCH_ATTEMPTS: InstitutionSearchConfig[] = [
    { select: "display_name", column: "display_name", hasId: false },
    { select: "id,display_name", column: "display_name", hasId: true },
    { select: '"display name"', column: "display name", hasId: false },
    { select: 'id,"display name"', column: "display name", hasId: true },
]

let resolvedConfig: InstitutionSearchConfig | null = null

function escapeIlikePattern(value: string): string {
    return value.replace(/[%_\\]/g, "\\$&")
}

function labelFromRow(
    row: Record<string, unknown>,
    config: InstitutionSearchConfig
): string {
    if (config.column === "display_name") {
        return typeof row.display_name === "string" ? row.display_name : ""
    }
    const spaced = row["display name"]
    return typeof spaced === "string" ? spaced : ""
}

function idFromRow(row: Record<string, unknown>, label: string, config: InstitutionSearchConfig): string {
    if (config.hasId && row.id !== undefined && row.id !== null) {
        return String(row.id)
    }
    return label
}

function rankItems(items: InstitutionSearchItem[], q: string, limit: number): InstitutionSearchItem[] {
    const qLower = q.toLocaleLowerCase()
    return items
        .sort((a, b) => {
            const aLower = a.label.toLocaleLowerCase()
            const bLower = b.label.toLocaleLowerCase()
            const aStarts = aLower.startsWith(qLower)
            const bStarts = bLower.startsWith(qLower)
            if (aStarts !== bStarts) return aStarts ? -1 : 1
            const aPos = aLower.indexOf(qLower)
            const bPos = bLower.indexOf(qLower)
            if (aPos !== bPos) return aPos - bPos
            return aLower.localeCompare(bLower)
        })
        .slice(0, limit)
}

async function runInstitutionSearch(
    q: string,
    limit: number,
    config: InstitutionSearchConfig
): Promise<{ rows: Record<string, unknown>[] | null; error: { message?: string } | null }> {
    const supabase = getSupabase()
    const pattern = `%${escapeIlikePattern(q)}%`
    const result = await supabase
        .from("institutions")
        .select(config.select)
        .ilike(config.column, pattern)
        .limit(limit)
    return {
        rows: (result.data as Record<string, unknown>[] | null) ?? null,
        error: result.error,
    }
}

function rowsToItems(
    rows: Record<string, unknown>[] | null,
    config: InstitutionSearchConfig
): InstitutionSearchItem[] {
    const dedupedByLabel = new Map<string, InstitutionSearchItem>()
    for (const row of rows ?? []) {
        const label = labelFromRow(row, config)
        if (!label) continue
        const id = idFromRow(row, label, config)
        if (!id) continue
        if (!dedupedByLabel.has(label)) {
            dedupedByLabel.set(label, { id, label })
        }
    }
    return Array.from(dedupedByLabel.values())
}

/** Search institution directory for autocomplete (single round trip after schema is resolved). */
export async function searchInstitutions(q: string, limit = 12): Promise<InstitutionSearchItem[]> {
    const query = q.trim()
    if (query.length < 2 || !isSupabaseConfigured()) return []

    const configs = resolvedConfig ? [resolvedConfig] : SEARCH_ATTEMPTS

    for (const config of configs) {
        const { rows, error } = await runInstitutionSearch(query, limit, config)
        if (!error) {
            resolvedConfig = config
            return rankItems(rowsToItems(rows, config), query, limit)
        }
    }

    return []
}

/** @internal Test-only reset for schema resolution cache. */
export function resetInstitutionSearchConfigForTests(): void {
    resolvedConfig = null
}
