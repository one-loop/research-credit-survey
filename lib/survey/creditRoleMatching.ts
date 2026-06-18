import { creditRoles } from "@/lib/mockData"
import type { Author } from "@/lib/types"

/** Normalize CRediT role strings for fuzzy matching across data sources. */
export function normalizeContributionLabel(label: string): string {
    return label
        .toLowerCase()
        .replace(/[\u2013\u2014–—]/g, " ")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ")
}

const ROLE_ALIASES: Record<string, string[]> = {
    methodology: ["methodology", "methdology"],
    "formal analysis": ["formal analysis"],
    "data curation": ["data curation"],
    "writing original draft": ["writing original draft"],
    "writing review editing": ["writing review editing", "writing review and editing"],
    "funding acquisition": ["funding acquisition"],
    "project administration": ["project administration"],
}

function aliasesForRole(roleName: string): string[] {
    const normalized = normalizeContributionLabel(roleName)
    return ROLE_ALIASES[normalized] ?? [normalized]
}

export function authorHasCreditRole(contributions: string[], roleName: string): boolean {
    const aliases = new Set(aliasesForRole(roleName))
    return contributions.some((contribution) => {
        const normalized = normalizeContributionLabel(contribution)
        if (aliases.has(normalized)) return true
        for (const alias of aliases) {
            if (normalized.includes(alias) || alias.includes(normalized)) return true
        }
        return false
    })
}

export const CREDIT_ROLE_ROWS = creditRoles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
}))
