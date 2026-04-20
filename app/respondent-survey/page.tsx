"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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
                    <Select
                        value={primaryDomain}
                        onValueChange={(value) => {
                            setPrimaryDomain(value)
                            setPrimaryField("")
                        }}
                    >
                        <SelectTrigger id="primaryDomain" className={inputClass} aria-label="Primary domain of research">
                            <SelectValue placeholder="Select a domain" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.keys(DOMAIN_FIELDS).map((domain) => (
                                <SelectItem key={domain} value={domain}>
                                    {domain}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label htmlFor="primaryField" className="block text-sm font-medium mb-1.5">
                        Primary field of research
                    </label>
                    <Select
                        value={primaryField}
                        onValueChange={setPrimaryField}
                        disabled={!primaryDomain}
                    >
                        <SelectTrigger id="primaryField" className={inputClass} aria-label="Primary field of research">
                            <SelectValue placeholder={primaryDomain ? "Select a field" : "Select a domain first"} />
                        </SelectTrigger>
                        <SelectContent>
                            {(DOMAIN_FIELDS[primaryDomain] ?? []).map((field) => (
                                <SelectItem key={field} value={field}>
                                    {field}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label htmlFor="gender" className="block text-sm font-medium mb-1.5">
                        Gender
                    </label>
                    <Select
                        value={gender}
                        onValueChange={setGender}
                    >
                        <SelectTrigger id="gender" className={inputClass} aria-label="Gender">
                            <SelectValue placeholder="Select one" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer_not_to_say">Prefer Not to Say</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label htmlFor="race" className="block text-sm font-medium mb-1.5">
                        Race
                    </label>
                    <Select
                        value={race}
                        onValueChange={setRace}
                    >
                        <SelectTrigger id="race" className={inputClass} aria-label="Race">
                            <SelectValue placeholder="Select one" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="white">White</SelectItem>
                            <SelectItem value="black">Black</SelectItem>
                            <SelectItem value="hispanic">Hispanic</SelectItem>
                            <SelectItem value="asian">Asian</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer_not_to_say">Prefer Not to Say</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label id="institution-label" className="block text-sm font-medium mb-1.5">
                        Institution (optional)
                    </label>
                    <Combobox
                        items={institutionOptions}
                        searchValue={institution}
                        onSearchValueChange={(value) => {
                            setInstitution(value)
                            setInstitutionId("")
                        }}
                        onValueChange={(option) => {
                            setInstitution(option.label)
                            setInstitutionId(option.id)
                        }}
                        itemToStringValue={(option) => option.label}
                        itemKey={(option) => option.id}
                        placeholder="Start typing your institution name"
                        loading={institutionLoading}
                        emptyText="No matching institutions found."
                    />
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

