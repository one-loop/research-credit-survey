"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Spinner } from "@/components/ui/spinner"


type RespondentContext = { journal: string | null; field: string | null }

function HomeContent() {
    const searchParams = useSearchParams()
    const authorId = searchParams.get("authorId")
    const [context, setContext] = useState<RespondentContext | null>(null)
    const [loadingContext, setLoadingContext] = useState(Boolean(authorId))
    const beginHref = authorId ? `/respondent-survey?authorId=${encodeURIComponent(authorId)}` : "/respondent-survey"

    useEffect(() => {
        if (typeof window === "undefined") return
        // Treat every landing-page visit as a fresh session.
        window.sessionStorage.clear()
        setContext(null)
        setLoadingContext(Boolean(authorId))
    }, [authorId])

    useEffect(() => {
        if (!authorId) {
            setLoadingContext(false)
            return
        }
        let cancelled = false
        setLoadingContext(true)
        fetch(`/api/survey/respondent-context?authorId=${encodeURIComponent(authorId)}`)
            .then((res) => (res.ok ? (res.json() as Promise<RespondentContext>) : Promise.resolve({ journal: null, field: null })))
            .then((data) => {
                if (!cancelled) {
                    setContext(data)
                    if (typeof window !== "undefined") {
                        const keyAuthor = authorId ?? "none"
                        window.sessionStorage.setItem(`respondentContext_${keyAuthor}`, JSON.stringify(data))
                    }
                }
            })
            .catch(() => {
                if (!cancelled) setContext({ journal: null, field: null })
            })
            .finally(() => {
                if (!cancelled) setLoadingContext(false)
            })
        return () => {
            cancelled = true
        }
    }, [authorId])

    if (authorId && loadingContext) {
        return (
            <div className="max-w-3xl mx-auto p-6 flex flex-row gap-4 items-center">
                <Spinner />
                <p className="text-muted-foreground">Loading Experiment... Just a moment</p>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Contribution Ranking Study</h1>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                    The estimated time for this study is 5 minutes.
                </p>
                <p>
                    Welcome to this study, which is carried out by Bedoor AlShebli and Shehryar Ahmed Subhani from New York University Abu Dhabi.
                    {authorId && !loadingContext && context?.journal && context?.field ? (
                        <> We are reaching out to you as we have identified you as a corresponding author in {context.journal} in the field of {context.field}.</>
                    ) : null}
                </p>
                <p>In recent years, many academic journals have adopted the CRediT taxonomy to provide greater transparency around individual contributions to research. Rather than relying solely on authorship order, these journals use contributor roles to clarify who was responsible for specific aspects of the work, improving accountability and recognition across collaborative research. We aim to study how individuals interpret contributor roles and assess their relative importance in research publications.</p>
                <p>Should you choose to participate in this study, you will do the following:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Read the instructions describing Contributor Role Taxonomy (CRediT) roles definitions and familiarize yourself with them. We will then ask you to rate the importance of each role towards a publication in your field.</li>
                    <li>Complete a set of tasks in which you will create an author byline based on disclosed author contributions.</li>
                </ul>
                <p>
                    Participation in this study is voluntary and you may leave the study at any point. We do not anticipate any risks to you directly resulting from your participation in this study.
                    You will be assisting in the collection of valuable data about how contributor roles relate to authorship order in research publications.
                </p>
                <p>
                    Some identifiable information, such as your gender and race, will be collected during the study but will not be shared, ensuring that your participation remains anonymous. Only authorized members of the research team will have access to the data, and all information will be stored securely. The anonymized data may be used for research purposes, presentations, or publications.
                </p>
                <p>Please answer all questions based on your own judgment and experience with research collaboration within your field.</p>
                <p>
                    If you have questions about either the study or your participation, you may contact Bedoor AlShebli at{" "}
                    <a href="mailto:bedoor@nyu.edu" className="underline underline-offset-4">bedoor@nyu.edu</a>.
                </p>
                <p>
                    For questions about your rights as a research participant, you may contact the IRB and refer to #____________, New York University Abu Dhabi,
                    +971 2 628 4313 or{" "}
                    <a href="mailto:IRBnyuad@nyu.edu" className="underline underline-offset-4">IRBnyuad@nyu.edu</a>. If you would like to have a copy of this document,
                    please make a screenshot and keep it.
                </p>
                <p>
                    By clicking the button below you agree to participate in the study. ONLY click this button if you intend to participate. You can only participate in the study once.
                </p>
            </div>

            <div className="mt-8 flex justify-end">
                <Button asChild>
                    <Link href={beginHref}>Begin</Link>
                </Button>
            </div>
        </div>
    )
}

export default function Home() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        }>
            <HomeContent />
        </Suspense>
    )
}
