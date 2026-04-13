import type { Author, Work } from "@/lib/types"

/** Example titles for practice only (not real survey stimuli). */
const TRIAL_TITLES: Record<string, string> = {
    "Life Sciences": "Biological pathways and disease risk (practice example)",
    "Physical Sciences": "Materials behavior under stress (practice example)",
    "Social Sciences": "Survey design and nonresponse bias (practice example)",
    "Arts and Humanities": "Digital archives and public memory (practice example)",
    "Business, Management and Accounting": "Team incentives and project performance (practice example)",
    "Decision Sciences": "Judgment under uncertainty in forecasting (practice example)",
    "Economics, Econometrics and Finance": "Credit constraints and small-firm growth (practice example)",
    Psychology: "Attention and decision-making under load (practice example)",
    Dentistry: "Oral health interventions in community samples (practice example)",
    "Health Professions": "Clinical training outcomes and competency (practice example)",
    Medicine: "Sleep, inflammation, and recovery (practice example)",
    Nursing: "Patient education and readmission rates (practice example)",
    Veterinary: "Zoonotic risk and surveillance networks (practice example)",
    "Chemical Engineering": "Catalyst stability in continuous reactors (practice example)",
    Chemistry: "Reaction pathways in aqueous catalysis (practice example)",
    "Computer Science": "Robustness of text classifiers to domain shift (practice example)",
    "Earth and Planetary Sciences": "Paleoclimate proxies from sediment cores (practice example)",
    Energy: "Grid-scale storage and peak shaving (practice example)",
    Engineering: "Structural health monitoring with sparse sensors (practice example)",
    "Environmental Science": "Urban heat islands and vegetation cover (practice example)",
    "Materials Science": "Thin-film interfaces and adhesion (practice example)",
    Mathematics: "Spectral bounds for sparse graphs (practice example)",
    "Physics and Astronomy": "Noise limits in weak-lensing surveys (practice example)",
    "Agricultural and Biological Sciences": "Crop rotation and soil microbiome (practice example)",
    "Biochemistry, Genetics and Molecular Biology": "Epigenetic regulation in cell stress (practice example)",
    "Immunology and Microbiology": "Host–pathogen co-evolution in chronic infection (practice example)",
    Neuroscience: "Oscillatory coupling during learning tasks (practice example)",
    "Pharmacology, Toxicology and Pharmaceutics": "Dose–response modeling in combination therapy (practice example)",
}

function trialAuthorsForExperiment(experiment: "A" | "C"): Author[] {
    const base: Author[] = [
        {
            id: "trial_a1",
            initials: "J.M.",
            contributions: ["Conceptualization", "Methodology", "Supervision"],
            is_corresponding: false,
        },
        {
            id: "trial_a2",
            initials: "K.T.",
            contributions: ["Investigation", "Formal analysis", "Visualization"],
            is_corresponding: false,
        },
        {
            id: "trial_a3",
            initials: "R.L.",
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
            initials: "S.N.",
            contributions: ["Software", "Validation", "Resources"],
            is_corresponding: false,
        },
    ]
    if (experiment === "A") {
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
export function getTrialWorkForDomain(domain: string | undefined, experiment: "A" | "C"): Work {
    const d = domain && TRIAL_TITLES[domain] ? domain : undefined
    const displayName = d ? TRIAL_TITLES[d] : "Collaboration and authorship (practice example)"
    const domainLabel = d ?? "General"
    const slug = domainLabel.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase() || "general"
    return {
        work_id: `trial_practice_${slug}`,
        display_name: displayName,
        field: domainLabel,
        domain: domainLabel,
        journal: "PLOS ONE (practice example)",
        publication_date: "2018-01-01",
        authors: trialAuthorsForExperiment(experiment),
    }
}

export function getRespondentDomainFromSession(authorId: string | undefined): string | undefined {
    if (typeof window === "undefined") return undefined
    const keyAuthor = authorId ?? "none"
    const raw = window.sessionStorage.getItem(`experimentWorks_${keyAuthor}`)
    if (!raw) return undefined
    try {
        const data = JSON.parse(raw) as { works?: Array<{ domain?: string; field?: string }> }
        const domain = data.works?.[0]?.domain
        if (typeof domain === "string") return domain
        const field = data.works?.[0]?.field
        return typeof field === "string" ? field : undefined
    } catch {
        return undefined
    }
}

// Backward-compatible aliases for existing imports/callers.
export const getTrialWorkForField = getTrialWorkForDomain
export const getRespondentFieldFromSession = getRespondentDomainFromSession

export function getAssignedExperimentFromSession(authorId: string | undefined): "A" | "C" {
    if (typeof window === "undefined") return "A"
    const keyAuthor = authorId ?? "none"
    const v = window.sessionStorage.getItem(`surveyExperiment_${keyAuthor}`)
    return v === "C" ? "C" : "A"
}

export function trialPassedKey(authorId: string | undefined): string {
    return `comprehensionTrialPassed_${authorId ?? "none"}`
}

export function trialFailedKey(authorId: string | undefined): string {
    return `comprehensionTrialFailed_${authorId ?? "none"}`
}
