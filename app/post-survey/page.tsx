"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function PostSurveyContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const responseId = searchParams.get("responseId")
    const authorId = searchParams.get("authorId") ?? undefined

    const [gender, setGender] = useState("")
    const [genderSelfDescribe, setGenderSelfDescribe] = useState("")
    const [ageRange, setAgeRange] = useState("")
    const [careerStage, setCareerStage] = useState("")
    const [yearsInResearch, setYearsInResearch] = useState("")
    const [primaryField, setPrimaryField] = useState("")
    const [countryRegion, setCountryRegion] = useState("")
    const [highestDegree, setHighestDegree] = useState("")
    const [comments, setComments] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!responseId) return
        setSubmitting(true)
        setError(null)

        const demographics: Record<string, string> = {}
        const genderValue =
            gender === "self_describe" ? (genderSelfDescribe.trim() || "self_describe") : gender
        if (genderValue) demographics.gender = genderValue
        if (ageRange) demographics.age_range = ageRange
        if (careerStage) demographics.career_stage = careerStage
        if (yearsInResearch) demographics.years_in_research = yearsInResearch
        if (primaryField.trim()) demographics.primary_field = primaryField.trim()
        if (countryRegion.trim()) demographics.country_or_region = countryRegion.trim()
        if (highestDegree) demographics.highest_degree = highestDegree
        if (comments.trim()) demographics.additional_comments = comments.trim()

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
                These details help us interpret the results. All fields are optional; skip anything you prefer not to answer.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="gender" className="block text-sm font-medium mb-1.5">
                        Gender
                    </label>
                    <select
                        id="gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Prefer not to say</option>
                        <option value="woman">Woman</option>
                        <option value="man">Man</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="self_describe">Prefer to self-describe</option>
                    </select>
                    {gender === "self_describe" ? (
                        <input
                            type="text"
                            value={genderSelfDescribe}
                            onChange={(e) => setGenderSelfDescribe(e.target.value)}
                            placeholder="How do you describe your gender?"
                            className={`${inputClass} mt-2`}
                            autoComplete="off"
                        />
                    ) : null}
                </div>

                <div>
                    <label htmlFor="ageRange" className="block text-sm font-medium mb-1.5">
                        Age range
                    </label>
                    <select id="ageRange" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} className={inputClass}>
                        <option value="">Prefer not to say</option>
                        <option value="under_25">Under 25</option>
                        <option value="25_34">25–34</option>
                        <option value="35_44">35–44</option>
                        <option value="45_54">45–54</option>
                        <option value="55_64">55–64</option>
                        <option value="65_plus">65 or older</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="careerStage" className="block text-sm font-medium mb-1.5">
                        Career stage
                    </label>
                    <select
                        id="careerStage"
                        value={careerStage}
                        onChange={(e) => setCareerStage(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Prefer not to say</option>
                        <option value="undergraduate">Undergraduate student</option>
                        <option value="graduate">Graduate student</option>
                        <option value="postdoc">Postdoctoral researcher</option>
                        <option value="faculty">Faculty / research staff</option>
                        <option value="industry">Industry / other non-academic</option>
                        <option value="retired">Retired</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="yearsInResearch" className="block text-sm font-medium mb-1.5">
                        Years involved in research (approximate)
                    </label>
                    <select
                        id="yearsInResearch"
                        value={yearsInResearch}
                        onChange={(e) => setYearsInResearch(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Prefer not to say</option>
                        <option value="0_2">0–2 years</option>
                        <option value="3_5">3–5 years</option>
                        <option value="6_10">6–10 years</option>
                        <option value="11_20">11–20 years</option>
                        <option value="21_plus">More than 20 years</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="primaryField" className="block text-sm font-medium mb-1.5">
                        Primary field or discipline
                    </label>
                    <input
                        id="primaryField"
                        type="text"
                        value={primaryField}
                        onChange={(e) => setPrimaryField(e.target.value)}
                        placeholder="e.g. molecular biology, economics"
                        className={inputClass}
                        autoComplete="organization-title"
                    />
                </div>

                <div>
                    <label htmlFor="countryRegion" className="block text-sm font-medium mb-1.5">
                        Country or region
                    </label>
                    <input
                        id="countryRegion"
                        type="text"
                        value={countryRegion}
                        onChange={(e) => setCountryRegion(e.target.value)}
                        placeholder="e.g. United States, Western Europe"
                        className={inputClass}
                        autoComplete="country-name"
                    />
                </div>

                <div>
                    <label htmlFor="highestDegree" className="block text-sm font-medium mb-1.5">
                        Highest degree earned
                    </label>
                    <select
                        id="highestDegree"
                        value={highestDegree}
                        onChange={(e) => setHighestDegree(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Prefer not to say</option>
                        <option value="none_in_progress">None yet / in progress</option>
                        <option value="bachelors">Bachelor&apos;s or equivalent</option>
                        <option value="masters">Master&apos;s or equivalent</option>
                        <option value="doctoral">Doctoral degree (PhD, MD, etc.)</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="comments" className="block text-sm font-medium mb-1.5">
                        Anything else we should know? (optional)
                    </label>
                    <textarea
                        id="comments"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={3}
                        className={inputClass}
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
