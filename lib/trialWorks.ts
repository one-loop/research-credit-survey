import type { Author, Work } from "@/lib/types"
import { displayJournalName } from "@/lib/survey/journalDisplay"

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
    if (experiment === "A") {
        return base
    }
    if (experiment === "B") {
        return base.map((a) => ({
            ...a,
            // Mirror Experiment B behavior where some authors are shown as full anonymized names.
            name:
                a.id === "trial_a1"
                    ? "Alex Avery"
                    : a.id === "trial_a2"
                      ? "Bailey Brooks"
                      : a.id === "trial_a3"
                        ? "Casey Cole"
                        : a.id === "trial_a4"
                          ? "Diana Davis"
                          : undefined,
        }))
    }
    return base.map((a, i) => ({
        ...a,
        first_institution_name:
            a.id === "trial_a3"
                ? "yes"
                : ["yes", "yes", "no", "no"][i],
        academic_age: [8, 5, 12, 3][i],
        h_index: [14, 9, 22, 6][i],
    }))
}

/**
 * Practice paper keyed to the respondent's broad domain when available.
 */
export function getTrialWorkForDomain(
    domain: string | undefined,
    experiment: "A" | "B" | "C",
    journal?: string
): Work {
    const domainLabel = normalizeDomain(domain)
    const displayName = TRIAL_TITLES[domainLabel]
    const slug = domainLabel.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase() || "general"
    return {
        work_id: `trial_practice_${slug}`,
        display_name: displayName,
        domain: domainLabel,
        journal: displayJournalName(journal),
        publication_date: "2018-01-01",
        authors: trialAuthorsForExperiment(experiment),
    }
}

export function getRespondentContextFromSession(
    authorId: string | undefined
): { domain?: string; journal?: string } {
    if (typeof window === "undefined") return {}
    const keyAuthor = authorId ?? "none"
    const cachedContext = window.sessionStorage.getItem(`respondentContext_${keyAuthor}`)
    if (cachedContext) {
        try {
            const parsed = JSON.parse(cachedContext) as { domain?: string; journal?: string }
            return {
                domain: typeof parsed.domain === "string" ? parsed.domain : undefined,
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
            works?: Array<{ domain?: string; journal?: string; authors?: Array<{ id?: string }> }>
        }
        const ownWork = authorId
            ? data.works?.find((w) => Array.isArray(w.authors) && w.authors.some((a) => a.id === authorId))
            : undefined
        const base = ownWork ?? data.works?.[0]
        return {
            domain: base?.domain,
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
