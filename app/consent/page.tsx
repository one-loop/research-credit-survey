"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ChevronDown, ChevronUp, HelpCircle, ShieldCheck } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { SurveyLoadingScreen } from "@/components/SurveyLoadingScreen"
import { FadeIn, SurveyPageEnter } from "@/components/SurveyMotion"

type VerificationResponsePayload = {
    workId: string
    title: string
    journal: string
    year: string
    correctAuthors: Array<{ id: string; name: string; initials: string; isCorresponding: boolean }>
    respondentRanking: Array<{ id: string; name: string; initials: string }>
    accuracy: number | null
}

function ConsentContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const responseId = searchParams.get("responseId") || ""
    const experimentType = searchParams.get("experimentType") || "A"
    const queue = Number(searchParams.get("queue") ?? "0")

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [ownPapers, setOwnPapers] = useState<VerificationResponsePayload[]>([])
    const [explanation, setExplanation] = useState("")
    const [whyShowingOpen, setWhyShowingOpen] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const explanationRef = useRef(explanation)
    explanationRef.current = explanation

    const handleConsentAction = useCallback(async (status: "consented" | "withdrawn" | "not_my_paper") => {
        if (!responseId) return
        setActionLoading(status)

        try {
            const currentExplanation = explanationRef.current.trim()
            const res = await fetch("/api/survey/verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    responseId,
                    consentStatus: status,
                    explanation: currentExplanation || undefined,
                })
            })

            if (!res.ok) {
                throw new Error("Failed to register choice")
            }

            // Redirect to thanks page with appropriate parameters
            router.replace(
                `/survey-thanks?experimentType=${experimentType}&queue=${queue}&responseId=${encodeURIComponent(responseId)}&consent=${status}`
            )
        } catch (err: any) {
            alert(err.message || "Failed to save consent choice. Please try again.")
            setActionLoading(null)
        }
    }, [responseId, experimentType, queue, router])

    useEffect(() => {
        if (!responseId) {
            setError("No response reference found. Cannot verify consent.")
            setLoading(false)
            return
        }

        let cancelled = false
        setLoading(true)
        setError(null)

        fetch(`/api/survey/verification?responseId=${encodeURIComponent(responseId)}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch verification info")
                return res.json()
            })
            .then((data: {
                ok?: boolean
                ownPapers?: VerificationResponsePayload[]
                error?: string
                alreadyConsented?: boolean
            }) => {
                if (cancelled) return
                if (!data.ok || !data.ownPapers) {
                    throw new Error(data.error || "Failed to load verification info")
                }

                // If they have already consented to a previous block in the study,
                // auto-consent this block and bypass the verification/consent page
                if (data.alreadyConsented) {
                    handleConsentAction("consented")
                    return
                }

                setOwnPapers(data.ownPapers)

                // If this response did not contain any own papers, skip consent
                if (data.ownPapers.length === 0) {
                    router.replace(`/survey-thanks?experimentType=${experimentType}&queue=${queue}&responseId=${encodeURIComponent(responseId)}`)
                }
            })
            .catch((err: any) => {
                if (!cancelled) {
                    setError(err.message || "An error occurred while loading verification details.")
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [responseId, experimentType, queue, router, handleConsentAction])

    if (loading) {
        return <SurveyLoadingScreen message="Loading verification details…" />
    }

    if (error || ownPapers.length === 0) {
        return (
            <div className="max-w-3xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
                <AlertCircle className="h-10 w-10 text-destructive mb-2" />
                <h2 className="text-xl font-bold">Verification Error</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                    {error || "No matching publication found to verify. Redirecting..."}
                </p>
                <Button
                    onClick={() => router.replace(`/survey-thanks?experimentType=${experimentType}&queue=${queue}&responseId=${encodeURIComponent(responseId)}`)}
                >
                    Continue to Thanks
                </Button>
            </div>
        )
    }

    return (
        <SurveyPageEnter className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Main Header & Intro */}
            <FadeIn>
                <h1 className="text-2xl font-bold mb-3 tracking-tight">Publication Verification & Consent</h1>
                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 p-4 rounded-lg border border-border/50">
                    This paper was initially presented without identifying information so that your response would not be influenced by recognizing the paper, its authors, or its published author order. We are now asking you to confirm whether the paper is yours and to decide whether we may use your response in a separate sub-analysis.
                </p>
            </FadeIn>

            {/* Paper Details Card */}
            {ownPapers.map((paper) => {
                const pctAccuracy = paper.accuracy !== null ? Math.round(paper.accuracy * 100) : null

                return (
                    <FadeIn key={paper.workId} delay={40}>
                        <Card className="bg-muted/40 border-border/50 shadow-none">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg font-bold leading-tight text-foreground">
                                    {paper.title}
                                </CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">
                                    Published in <span className="font-medium text-foreground">{paper.journal}</span> • {paper.year}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Canonical Byline */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Original Publication Byline
                                    </h4>
                                    <p className="text-sm bg-background border rounded-md p-3 leading-relaxed text-foreground">
                                        {paper.correctAuthors.map((author, idx) => (
                                            <span key={author.id}>
                                                <span className={author.isCorresponding ? "font-semibold underline underline-offset-2" : ""}>
                                                    {author.name}
                                                </span>
                                                {author.isCorresponding && " (Corresponding)"}
                                                {idx < paper.correctAuthors.length - 1 && ", "}
                                            </span>
                                        ))}
                                    </p>
                                </div>

                                {/* Sorted Ordering */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Your Contribution Sorting
                                    </h4>
                                    <div className="bg-background border rounded-md p-3 divide-y divide-border/50">
                                        {paper.respondentRanking.map((author, idx) => (
                                            <div key={author.id} className="py-1.5 flex items-center text-sm">
                                                <span className="text-xs font-mono text-muted-foreground w-6">
                                                    {idx + 1}.
                                                </span>
                                                <span className="font-medium text-foreground">
                                                    {author.name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Accuracy Score */}
                                {pctAccuracy !== null && (
                                    <div className="flex items-center justify-between border-t pt-4 text-sm">
                                        <span className="text-muted-foreground">Sorting Concordance Accuracy</span>
                                        <span className="font-bold text-violet-700 dark:text-violet-300 bg-violet-100/30 dark:bg-violet-950/20 px-2.5 py-0.5 rounded border border-violet-200/50 dark:border-violet-800/30">
                                            {pctAccuracy}%
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </FadeIn>
                )
            })}

            {/* Why We Are Showing You This (Collapsible) */}
            <FadeIn delay={80}>
                <Card className="bg-muted/40 border-border/50 shadow-none overflow-hidden">
                    <CardHeader
                        className="pb-3 cursor-pointer select-none hover:bg-muted/60 transition-colors"
                        onClick={() => setWhyShowingOpen((prev) => !prev)}
                    >
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                <HelpCircle className="h-4 w-4 text-foreground shrink-0" />
                                Why we are showing you this
                            </CardTitle>
                            <div className="text-muted-foreground">
                                {whyShowingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                        </div>
                    </CardHeader>
                    {whyShowingOpen && (
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground pt-1 border-t border-border/40">
                            <p>
                                Author order does not always map directly or unambiguously onto the contributions listed in a paper. Differences may arise for several legitimate reasons. For example:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
                                <li>
                                    The published byline may reflect disciplinary conventions, seniority, supervision, or project leadership that is not fully represented in the contribution statement.
                                </li>
                                <li>
                                    The contribution statement may not capture all of the work, negotiations, or circumstances that influenced the final author order.
                                </li>
                                <li>
                                    Institutional, interpersonal, or political considerations may have affected the byline.
                                </li>
                                <li>
                                    Your interpretation of the contributions may reasonably differ from the interpretation used when the paper was published.
                                </li>
                            </ul>
                            <p>
                                A difference between your selected order and the published byline does not necessarily mean that either ordering is incorrect. We are interested in understanding why these differences occur.
                            </p>
                            <p className="text-xs bg-background/60 p-3 rounded border border-border/40 font-medium text-foreground">
                                Your response and any explanation you provide will not be publicly attributed to you or to this paper. The results will be analyzed and reported only in anonymized or aggregated form.
                            </p>
                        </CardContent>
                    )}
                </Card>
            </FadeIn>

            {/* Optional Free-Text Explanation Box */}
            <FadeIn delay={100}>
                <Card className="bg-muted/40 border-border/50 shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-bold">
                            Optional Explanation of Differences
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                            Please use the space below to explain any factors that may account for this difference. You may describe, for example, contribution details that were not included in the contribution statement, disciplinary practices, authorship negotiations, supervisory roles, seniority, institutional considerations, or any other relevant circumstances.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            id="consent-explanation"
                            value={explanation}
                            onChange={(e) => setExplanation(e.target.value)}
                            rows={5}
                            maxLength={4000}
                            placeholder="Optional: Explain any relevant factors, contribution details, supervisory roles, or disciplinary practices..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[7rem]"
                        />
                    </CardContent>
                </Card>
            </FadeIn>

            {/* Consent Options & Action Cards */}
            <FadeIn delay={120} className="space-y-4 pt-2">
                <h3 className="text-base font-bold tracking-tight">Please select your decision:</h3>

                {/* Option 1: I Consent */}
                <div className="rounded-lg border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-sm text-emerald-950 dark:text-emerald-100">
                            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            I consent to use this response
                        </div>
                        <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                            By selecting this option, you confirm that the paper is yours and consent to the response and any optional explanation being used in the own-paper sub-analysis. The information will remain anonymized and will not be reported in a way that identifies you or the paper.
                        </p>
                    </div>
                    <div className="flex justify-end pt-1">
                        <Button
                            variant="default"
                            onClick={() => handleConsentAction("consented")}
                            disabled={actionLoading !== null}
                            className="sm:min-w-[14rem] bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                        >
                            {actionLoading === "consented" && <Spinner className="mr-2" />}
                            I consent to use this response
                        </Button>
                    </div>
                </div>

                {/* Option 2: This is not my paper */}
                <div className="rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3">
                    <div className="space-y-1">
                        <div className="font-semibold text-sm text-amber-950 dark:text-amber-100">
                            This is not my paper
                        </div>
                        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                            Select this option if you are not an author of the paper or believe that the paper has been incorrectly matched to you. The response will not be included in the own-paper sub-analysis.
                        </p>
                    </div>
                    <div className="flex justify-end pt-1">
                        <Button
                            variant="default"
                            onClick={() => handleConsentAction("not_my_paper")}
                            disabled={actionLoading !== null}
                            className="sm:min-w-[14rem] bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
                        >
                            {actionLoading === "not_my_paper" && <Spinner className="mr-2" />}
                            This is not my paper
                        </Button>
                    </div>
                </div>

                {/* Option 3: Withdraw this response */}
                <div className="rounded-lg border border-red-200/60 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10 p-4 space-y-3">
                    <div className="space-y-1">
                        <div className="font-semibold text-sm text-destructive">
                            Withdraw this response
                        </div>
                        <p className="text-xs text-red-900/90 dark:text-red-200/90 leading-relaxed">
                            Select this option if you do not want the response associated with this paper to be retained or analyzed. You may wish to withdraw because you are uncomfortable with the paper having been included, because the response could be personally sensitive, or for any other reason. You do not need to provide a reason.
                        </p>
                    </div>
                    <div className="flex justify-end pt-1">
                        <Button
                            variant="destructive"
                            onClick={() => handleConsentAction("withdrawn")}
                            disabled={actionLoading !== null}
                            className="sm:min-w-[14rem] bg-gradient-to-b from-[#c8323a] via-[#b92c33] to-[#aa282f] border border-t-white/10 border-b-black/30 border-x-black/20 text-white hover:from-[#b92c33] hover:to-[#aa282f]"
                        >
                            {actionLoading === "withdrawn" && <Spinner className="mr-2" />}
                            Withdraw this response
                        </Button>
                    </div>
                </div>
            </FadeIn>
        </SurveyPageEnter>
    )
}

export default function ConsentPage() {
    return (
        <Suspense fallback={<SurveyLoadingScreen message="Loading..." />}>
            <ConsentContent />
        </Suspense>
    )
}
