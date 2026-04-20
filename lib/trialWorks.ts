import type { Author, Work } from "@/lib/types"

/** Example titles for practice only (not real survey stimuli). */
const TRIAL_TITLES: Record<string, string> = {
    "Life Sciences": "Biological pathways and disease risk",
    "Health Sciences": "Care pathways and patient outcomes",
    "Physical Sciences": "Materials behavior under stress",
    "Social Sciences": "Survey design and nonresponse bias",
}

const ALLOWED_DOMAINS = new Set(["Social Sciences", "Life Sciences", "Physical Sciences", "Health Sciences"])

function normalizeDomain(domain: string | undefined): string {
    if (!domain) return "Social Sciences"
    if (ALLOWED_DOMAINS.has(domain)) return domain
    const d = domain.toLowerCase()
    if (d.includes("health") || d.includes("medicine") || d.includes("nursing") || d.includes("veterinary")) {
        return "Health Sciences"
    }
    if (d.includes("life") || d.includes("bio") || d.includes("neuro") || d.includes("pharma") || d.includes("immun")) {
        return "Life Sciences"
    }
    if (d.includes("physical") || d.includes("chem") || d.includes("physics") || d.includes("engineering") || d.includes("material")) {
        return "Physical Sciences"
    }
    return "Social Sciences"
}

function normalizeJournal(journal: string | undefined): "PLOS ONE" | "PNAS" {
    const j = (journal ?? "").toLowerCase()
    if (j.includes("proceedings of the national academy of sciences") || j.includes("pnas")) {
        return "PNAS"
    }
    return "PLOS ONE"
}

function trialAuthorsForExperiment(experiment: "A" | "B" | "C"): Author[] {
    const base: Author[] = [
        {
            id: "trial_a1",
            initials: "A.A.",
            contributions: ["Conceptualization", "Methodology", "Supervision"],
            is_corresponding: false,
        },
        {
            id: "trial_a2",
            initials: "B.B.",
            contributions: ["Investigation", "Formal analysis", "Visualization"],
            is_corresponding: false,
        },
        {
            id: "trial_a3",
            initials: "C.C.",
            contributions: [
                "Data curation",
                "Writing – original draft",
                "Writing – review & editing",
                "Project administration",
            ],
            is_corresponding: true,
        },
        {
            id: "trial_a4",
            initials: "D.D.",
            contributions: ["Software", "Validation", "Resources"],
            is_corresponding: false,
        },
    ]
    if (experiment === "A" || experiment === "B") {
        return base
    }
    return base.map((a, i) => ({
        ...a,
        first_institution_name:
            a.id === "trial_a3"
                ? "Example University"
                : ["North Institute", "East Laboratory", "Example University", "South Analytics Lab"][i],
        academic_age: [8, 5, 12, 3][i],
        h_index: [14, 9, 22, 6][i],
    }))
}

/**
 * Practice paper keyed to the respondent's broad domain when available,
 * then field as a compatibility fallback.
 */
export function getTrialWorkForDomain(
    domain: string | undefined,
    experiment: "A" | "B" | "C",
    journal?: string,
    field?: string
): Work {
    const domainLabel = normalizeDomain(domain)
    const displayName = TRIAL_TITLES[domainLabel]
    const fieldLabel = field && field.trim().length > 0 ? field : domainLabel
    const slug = domainLabel.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase() || "general"
    return {
        work_id: `trial_practice_${slug}`,
        display_name: displayName,
        field: fieldLabel,
        domain: domainLabel,
        journal: normalizeJournal(journal),
        publication_date: "2018-01-01",
        authors: trialAuthorsForExperiment(experiment),
    }
}

export function getRespondentContextFromSession(
    authorId: string | undefined
): { domain?: string; field?: string; journal?: string } {
    if (typeof window === "undefined") return {}
    const keyAuthor = authorId ?? "none"
    const cachedContext = window.sessionStorage.getItem(`respondentContext_${keyAuthor}`)
    if (cachedContext) {
        try {
            const parsed = JSON.parse(cachedContext) as { field?: string; journal?: string }
            const field = typeof parsed.field === "string" ? parsed.field : undefined
            return {
                domain: field,
                field,
                journal: typeof parsed.journal === "string" ? parsed.journal : undefined,
            }
        } catch {
            // fall through to works cache
        }
    }
    const raw = window.sessionStorage.getItem(`experimentWorks_${keyAuthor}`)
    if (!raw) return {}
    try {
        const data = JSON.parse(raw) as {
            works?: Array<{ domain?: string; field?: string; journal?: string; authors?: Array<{ id?: string }> }>
        }
        const ownWork = authorId
            ? data.works?.find((w) => Array.isArray(w.authors) && w.authors.some((a) => a.id === authorId))
            : undefined
        const base = ownWork ?? data.works?.[0]
        return {
            domain: base?.domain ?? base?.field,
            field: base?.field,
            journal: base?.journal,
        }
    } catch {
        return {}
    }
}

export function getRespondentDomainFromSession(authorId: string | undefined): string | undefined {
    return getRespondentContextFromSession(authorId).domain
}

// Backward-compatible aliases for existing imports/callers.
export const getTrialWorkForField = getTrialWorkForDomain
export const getRespondentFieldFromSession = getRespondentDomainFromSession

export function getAssignedExperimentFromSession(authorId: string | undefined): "A" | "B" | "C" {
    if (typeof window === "undefined") return "A"
    const keyAuthor = authorId ?? "none"
    const v = window.sessionStorage.getItem(`surveyExperiment_${keyAuthor}`)
    return v === "B" || v === "C" ? v : "A"
}

export function trialPassedKey(authorId: string | undefined): string {
    return `comprehensionTrialPassed_${authorId ?? "none"}`
}

export function trialFailedKey(authorId: string | undefined): string {
    return `comprehensionTrialFailed_${authorId ?? "none"}`
}
