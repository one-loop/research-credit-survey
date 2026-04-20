"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const DOMAIN_FIELDS: Record<string, string[]> = {
    "Life Sciences": [
        "Agricultural and Biological Sciences",
        "Biochemistry, Genetics and Molecular Biology",
        "Immunology and Microbiology",
        "Neuroscience",
        "Pharmacology, Toxicology and Pharmaceutics",
    ],
    "Social Sciences": [
        "Arts and Humanities",
        "Business, Management and Accounting",
        "Decision Sciences",
        "Economics, Econometrics and Finance",
        "Psychology",
        "Social Sciences",
    ],
    "Physical Sciences": [
        "Chemical Engineering",
        "Chemistry",
        "Computer Science",
        "Earth and Planetary Sciences",
        "Energy",
        "Engineering",
        "Environmental Science",
        "Materials Science",
        "Mathematics",
        "Physics and Astronomy",
    ],
    "Health Sciences": [
        "Medicine",
        "Nursing",
        "Veterinary",
        "Dentistry",
        "Health Professions",
    ],
}

type Demographics = {
    primary_domain: string
    primary_field: string
    gender: string
    race: string
    institution?: string
    institution_id?: string
}

type InstitutionOption = { id: string; label: string }

function RespondentSurveyContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const authorId = searchParams.get("authorId") ?? undefined
    const [primaryDomain, setPrimaryDomain] = useState("")
    const [primaryField, setPrimaryField] = useState("")
    const [gender, setGender] = useState("")
    const [race, setRace] = useState("")
    const [institution, setInstitution] = useState("")
    const [institutionId, setInstitutionId] = useState("")
    const [institutionOptions, setInstitutionOptions] = useState<InstitutionOption[]>([])
    const [institutionLoading, setInstitutionLoading] = useState(false)
    const [showInstitutionOptions, setShowInstitutionOptions] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (typeof window === "undefined") return
        const keyAuthor = authorId ?? "none"
        const raw = window.sessionStorage.getItem(`respondentDemographics_${keyAuthor}`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as Partial<Demographics>
            if (parsed.primary_domain) setPrimaryDomain(parsed.primary_domain)
            if (parsed.primary_field) setPrimaryField(parsed.primary_field)
            if (parsed.gender) setGender(parsed.gender)
            if (parsed.race) setRace(parsed.race)
            if (parsed.institution) setInstitution(parsed.institution)
            if (parsed.institution_id) setInstitutionId(parsed.institution_id)
        } catch {
            // ignore invalid cached value
        }
    }, [authorId])

    useEffect(() => {
        if (institution.trim().length < 2) {
            setInstitutionOptions([])
            setInstitutionLoading(false)
            return
        }

        const q = institution.trim()
        const handle = window.setTimeout(async () => {
            setInstitutionLoading(true)
            try {
                const res = await fetch(`/api/institutions/search?q=${encodeURIComponent(q)}`)
                const data = (await res.json()) as { items?: InstitutionOption[] }
                setInstitutionOptions(data.items ?? [])
                setShowInstitutionOptions(true)
            } catch {
                setInstitutionOptions([])
            } finally {
                setInstitutionLoading(false)
            }
        }, 300)

        return () => window.clearTimeout(handle)
    }, [institution])

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        setError(null)

        if (!primaryDomain || !primaryField || !gender || !race) {
            setError("Please complete all required fields.")
            setSubmitting(false)
            return
        }

        const demographics: Demographics = {
            primary_domain: primaryDomain,
            primary_field: primaryField,
            gender,
            race,
        }
        if (institution.trim()) demographics.institution = institution.trim()
        if (institutionId) demographics.institution_id = institutionId

        if (typeof window !== "undefined") {
            const keyAuthor = authorId ?? "none"
            window.sessionStorage.setItem(`respondentDemographics_${keyAuthor}`, JSON.stringify(demographics))
        }

        const nextHref = authorId ? `/credit-roles?authorId=${encodeURIComponent(authorId)}` : "/credit-roles"
        router.replace(nextHref)
    }

    return (
        <div className="max-w-lg mx-auto p-6">
            <h1 className="text-2xl font-bold mb-2">Demographic Survey</h1>
            <p className="text-muted-foreground mb-6 leading-relaxed">
                Please complete some details about yourself before continuing.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="primaryDomain" className="block text-sm font-medium mb-1.5">
                        Primary domain of research
                    </label>
                    <select
                        id="primaryDomain"
                        value={primaryDomain}
                        onChange={(e) => {
                            setPrimaryDomain(e.target.value)
                            setPrimaryField("")
                        }}
                        className={inputClass}
                        required
                    >
                        <option value="">Select a domain</option>
                        {Object.keys(DOMAIN_FIELDS).map((domain) => (
                            <option key={domain} value={domain}>
                                {domain}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="primaryField" className="block text-sm font-medium mb-1.5">
                        Primary field of research
                    </label>
                    <select
                        id="primaryField"
                        value={primaryField}
                        onChange={(e) => setPrimaryField(e.target.value)}
                        className={inputClass}
                        required
                        disabled={!primaryDomain}
                    >
                        <option value="">{primaryDomain ? "Select a field" : "Select a domain first"}</option>
                        {(DOMAIN_FIELDS[primaryDomain] ?? []).map((field) => (
                            <option key={field} value={field}>
                                {field}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="gender" className="block text-sm font-medium mb-1.5">
                        Gender
                    </label>
                    <select
                        id="gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className={inputClass}
                        required
                    >
                        <option value="">Select one</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer Not to Say</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="race" className="block text-sm font-medium mb-1.5">
                        Race
                    </label>
                    <select
                        id="race"
                        value={race}
                        onChange={(e) => setRace(e.target.value)}
                        className={inputClass}
                        required
                    >
                        <option value="">Select one</option>
                        <option value="white">White</option>
                        <option value="black">Black</option>
                        <option value="hispanic">Hispanic</option>
                        <option value="asian">Asian</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer Not to Say</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="institution" className="block text-sm font-medium mb-1.5">
                        Institution (optional)
                    </label>
                    <div className="relative">
                        <input
                            id="institution"
                            type="text"
                            value={institution}
                            onChange={(e) => {
                                setInstitution(e.target.value)
                                setInstitutionId("")
                                setShowInstitutionOptions(true)
                            }}
                            onFocus={() => setShowInstitutionOptions(true)}
                            onBlur={() => {
                                window.setTimeout(() => setShowInstitutionOptions(false), 120)
                            }}
                            placeholder="Start typing your institution name"
                            className={inputClass}
                            autoComplete="organization"
                        />
                        {showInstitutionOptions && (institutionLoading || institutionOptions.length > 0) ? (
                            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-background shadow-sm">
                                {institutionLoading ? (
                                    <p className="px-3 py-2 text-sm text-muted-foreground">Searching institutions…</p>
                                ) : (
                                    institutionOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                setInstitution(option.label)
                                                setInstitutionId(option.id)
                                                setShowInstitutionOptions(false)
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : null}
                    </div>
                    {institutionId ? (
                        <p className="mt-1 text-xs text-muted-foreground">Selected from institution directory.</p>
                    ) : (
                        <p className="mt-1 text-xs text-muted-foreground">No exact match selected; typed value will be saved as entered.</p>
                    )}
                </div>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={submitting}>
                        Continue
                    </Button>
                </div>
            </form>
        </div>
    )
}

export default function RespondentSurveyPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-lg mx-auto p-6">
                    <p className="text-muted-foreground">Loading…</p>
                </div>
            }
        >
            <RespondentSurveyContent />
        </Suspense>
    )
}

