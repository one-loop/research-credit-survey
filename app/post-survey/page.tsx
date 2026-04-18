"use client"

import { Suspense, useState } from "react"
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

function PostSurveyContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const responseId = searchParams.get("responseId")
    const authorId = searchParams.get("authorId") ?? undefined

    const [primaryDomain, setPrimaryDomain] = useState("")
    const [yearsInResearch, setYearsInResearch] = useState("")
    const [primaryField, setPrimaryField] = useState("")
    const [gender, setGender] = useState("")
    const [race, setRace] = useState("")
    const [institution, setInstitution] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!responseId) return
        setSubmitting(true)
        setError(null)

        if (!primaryDomain || !primaryField || !gender || !race) {
            setError("Please complete all required fields.")
            setSubmitting(false)
            return
        }

        const demographics: Record<string, string> = {
            primary_domain: primaryDomain,
            primary_field: primaryField,
            gender,
            race,
        }
        if (institution.trim()) demographics.institution = institution.trim()

        try {
            const res = await fetch("/api/survey/demographics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    responseId,
                    demographics,
                    authorId: authorId ?? null,
                }),
            })
            const data = (await res.json()) as { ok?: boolean; error?: string }
            if (!res.ok || !data.ok) {
                setError(data.error ?? "Could not save your answers. Please try again.")
                setSubmitting(false)
                return
            }
            router.replace("/survey-thanks")
        } catch {
            setError("Could not save your answers. Please try again.")
            setSubmitting(false)
        }
    }

    if (!responseId) {
        return (
            <div className="max-w-lg mx-auto p-6">
                <h1 className="text-2xl font-bold mb-2">Invalid link</h1>
                <p className="text-muted-foreground leading-relaxed">
                    This page needs a valid session from the study. If you completed the ranking task, return to the link you were given and
                    finish from there.
                </p>
            </div>
        )
    }

    return (
        <div className="max-w-lg mx-auto p-6">
            <h1 className="text-2xl font-bold mb-2">A few quick questions</h1>
            <p className="text-muted-foreground mb-6 leading-relaxed">
                These details help us interpret the results.
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
                    <input
                        id="institution"
                        type="text"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="e.g. University of Michigan"
                        className={inputClass}
                        autoComplete="organization"
                    />
                </div>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={submitting}>
                        {submitting ? "Saving…" : "Submit"}
                    </Button>
                </div>
            </form>
        </div>
    )
}

export default function PostSurveyPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-lg mx-auto p-6">
                    <p className="text-muted-foreground">Loading…</p>
                </div>
            }
        >
            <PostSurveyContent />
        </Suspense>
    )
}
