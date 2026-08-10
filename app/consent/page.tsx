"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ShieldCheck } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { SurveyLoadingScreen } from "@/components/SurveyLoadingScreen"
import { FadeIn, SurveyPageEnter } from "@/components/SurveyMotion"
import type { VerificationResponsePayload } from "@/app/api/survey/verification/route"

type PaperDecision = {
    status: "consented" | "withdrawn" | "not_my_paper" | null
    explanation: string
}

function ConsentContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const responseId = searchParams.get("responseId") || ""
    const responseIds = searchParams.get("responseIds") || ""
    const experimentType = searchParams.get("experimentType") || "A"
    const queue = Number(searchParams.get("queue") ?? "0")

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [ownPapers, setOwnPapers] = useState<VerificationResponsePayload[]>([])
    const [decisions, setDecisions] = useState<Record<string, PaperDecision>>({})
    const [submitting, setSubmitting] = useState(false)

    const decisionsRef = useRef(decisions)
    decisionsRef.current = decisions

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)

        const queryParams: string[] = []
        if (responseIds) queryParams.push(`responseIds=${encodeURIComponent(responseIds)}`)
        if (responseId) queryParams.push(`responseId=${encodeURIComponent(responseId)}`)

        fetch(`/api/survey/verification?${queryParams.join("&")}`)
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

                // If no own papers, proceed straight to study complete
                if (data.ownPapers.length === 0) {
                    router.replace(`/study-complete?experimentType=${experimentType}&queue=${queue}`)
                    return
                }

                setOwnPapers(data.ownPapers)

                // Initialize per-paper decisions state
                const initialDecisions: Record<string, PaperDecision> = {}
                for (const p of data.ownPapers) {
                    const key = p.responseId || p.workId
                    initialDecisions[key] = {
                        status: (p.consentStatus as any) || null,
                        explanation: p.consentExplanation || "",
                    }
                }
                setDecisions(initialDecisions)
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
    }, [responseId, responseIds, experimentType, queue, router])

    const setPaperStatus = (key: string, status: "consented" | "withdrawn" | "not_my_paper") => {
        setDecisions((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                status,
            },
        }))
    }

    const setPaperExplanation = (key: string, explanation: string) => {
        setDecisions((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                explanation,
            },
        }))
    }

    const handleSinglePaperSubmit = useCallback(async (key: string, status: "consented" | "withdrawn" | "not_my_paper") => {
        setSubmitting(true)
        const targetPaper = ownPapers.find((p) => (p.responseId || p.workId) === key)
        const currentExp = decisionsRef.current[key]?.explanation || ""

        try {
            const res = await fetch("/api/survey/verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    responseId: targetPaper?.responseId || responseId,
                    consentStatus: status,
                    explanation: currentExp.trim() || undefined,
                })
            })

            if (!res.ok) throw new Error("Failed to register choice")

            router.replace(`/study-complete?experimentType=${experimentType}&queue=${queue}`)
        } catch (err: any) {
            alert(err.message || "Failed to save consent choice. Please try again.")
            setSubmitting(false)
        }
    }, [ownPapers, responseId, experimentType, queue, router])

    const handleAllPapersSubmit = useCallback(async () => {
        setSubmitting(true)
        const currentDecisions = decisionsRef.current
        const payloadDecisions = ownPapers.map((p) => {
            const key = p.responseId || p.workId
            const dec = currentDecisions[key] || { status: "consented", explanation: "" }
            return {
                responseId: p.responseId || responseId,
                workId: p.workId,
                consentStatus: dec.status || "consented",
                explanation: dec.explanation.trim() || undefined,
            }
        })

        try {
            const res = await fetch("/api/survey/verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decisions: payloadDecisions })
            })

            if (!res.ok) throw new Error("Failed to register choices")

            router.replace(`/study-complete?experimentType=${experimentType}&queue=${queue}`)
        } catch (err: any) {
            alert(err.message || "Failed to save consent choices. Please try again.")
            setSubmitting(false)
        }
    }, [ownPapers, responseId, experimentType, queue, router])

    if (loading) {
        return <SurveyLoadingScreen message="Loading verification details…" />
    }

    if (error || ownPapers.length === 0) {
        return (
            <div className="max-w-3xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
                <AlertCircle className="h-10 w-10 text-destructive mb-2" />
                <h2 className="text-xl font-bold">Verification Error</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                    {error || "No matching publication found to verify."}
                </p>
                <Button
                    onClick={() => router.replace(`/study-complete?experimentType=${experimentType}&queue=${queue}`)}
                >
                    Complete Session
                </Button>
            </div>
        )
    }

    const allDecided = ownPapers.every((p) => {
        const key = p.responseId || p.workId
        return Boolean(decisions[key]?.status)
    })

    return (
        <SurveyPageEnter className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Main Header & Intro */}
            <FadeIn>
                <h1 className="text-2xl font-bold mb-3 tracking-tight">Publication Verification & Consent</h1>
                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 p-4 rounded-lg border border-border/50">
                    One or more of the papers you responded to across the blocks of tasks you completed were identified as papers that you published as the corresponding author. These papers were initially shown without identifying information so that your judgments would not be influenced by recognizing the paper, its authors, or its published author order. You may now review each identified paper, confirm whether it is yours, and choose whether to consent to or withdraw your response for that paper from the study. You may also optionally explain the factors that influenced the published byline ordering. This reflects the debriefing procedure described in the study walkthrough.
                </p>
            </FadeIn>

            {/* Individual Own Paper Sections */}
            {ownPapers.map((paper, paperIndex) => {
                const key = paper.responseId || paper.workId
                const currentDecision = decisions[key] || { status: null, explanation: "" }
                const pctAccuracy = paper.accuracy !== null ? Math.round(paper.accuracy * 100) : null

                return (
                    <FadeIn key={key} delay={60 + paperIndex * 20} className="space-y-6 pt-2">
                        {ownPapers.length > 1 && (
                            <h3 className="text-base font-bold tracking-tight text-primary">
                                Paper #{paperIndex + 1} of {ownPapers.length}
                            </h3>
                        )}

                        {/* Paper Details Card */}
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

                        {/* Debriefing & Explanatory Sections */}
                        <Card className="bg-card border-border/70 shadow-sm">
                            <CardContent className="p-6 space-y-6 text-sm leading-relaxed">
                                <div className="space-y-2">
                                    <h3 className="text-base font-bold text-foreground">
                                        Why was this information initially withheld?
                                    </h3>
                                    <p className="text-muted-foreground">
                                        This partial deception was necessary to answer our research questions. If you had known in advance that one of the papers was your own, or had been shown identifying information or the published author order, this knowledge could have influenced how you ranked the authors. Presenting the papers without this information allows us to compare authorship judgments made without prior knowledge of the published ordering.
                                    </p>
                                    <p className="text-muted-foreground">
                                        The <span className="font-medium text-foreground">other papers you evaluated were real published papers, not fabricated papers</span>, but identifying information was removed or replaced as described during the study.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-base font-bold text-foreground">
                                        How was your information obtained?
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Your publication and authorship information was obtained from <span className="font-medium text-foreground">publicly available sources</span>, including information provided by journals and publication metadata available through OpenAIex. This information was used to identify papers for which invited participants were corresponding authors and to construct the study tasks.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-base font-bold text-foreground">
                                        Why might your ordering differ from the published byline?
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Author order does not always map directly onto the contributions listed in a paper. Differences may reflect disciplinary conventions, seniority, supervision or leadership, contributions not fully captured by the contribution statement, authorship negotiations, or institutional or interpersonal considerations. A difference between your selected ordering and the published byline does <span className="font-medium text-foreground">not</span> necessarily indicate that either ordering is incorrect.
                                    </p>
                                    <p className="text-muted-foreground">
                                        If you wish, please explain any factors that may account for the published byline ordering or any difference between it and the ordering you selected.
                                    </p>
                                </div>

                                {/* Large Free-Text Box */}
                                <div className="pt-1">
                                    <textarea
                                        id={`consent-explanation-${key}`}
                                        value={currentDecision.explanation}
                                        onChange={(e) => setPaperExplanation(key, e.target.value)}
                                        rows={5}
                                        maxLength={4000}
                                        placeholder="Optional: Explain any factors that may account for the published byline ordering or any difference between it and the ordering you selected..."
                                        className="w-full rounded-md border border-input bg-background px-3.5 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[7rem]"
                                    />
                                </div>

                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <h3 className="text-base font-bold text-foreground">
                                        Confidentiality
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Your responses and any explanations you provide will remain confidential and will be analyzed only in anonymized or aggregated form. Any discrepancy between the author order you selected and the published author order <span className="font-medium text-foreground">will not be shared in an identifiable form with anyone outside the research team, including the journal, other authors, or your institution.</span>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Consent Choice Options */}
                        <div className="space-y-4 pt-1">
                            <h4 className="text-sm font-bold tracking-tight">Please select your decision for this paper:</h4>

                            {/* Option 1: Withdraw this response */}
                            <div className={`rounded-lg border p-4 space-y-3 transition-colors ${currentDecision.status === "withdrawn" ? "border-red-500 bg-red-100/60 dark:bg-red-950/30" : "border-red-200/70 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/15"}`}>
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
                                        onClick={() => {
                                            setPaperStatus(key, "withdrawn")
                                            if (ownPapers.length === 1) {
                                                void handleSinglePaperSubmit(key, "withdrawn")
                                            }
                                        }}
                                        disabled={submitting}
                                        className="sm:min-w-[14rem] bg-gradient-to-b from-[#c8323a] via-[#b92c33] to-[#aa282f] border border-t-white/10 border-b-black/30 border-x-black/20 text-white hover:from-[#b92c33] hover:to-[#aa282f]"
                                    >
                                        {submitting && currentDecision.status === "withdrawn" && <Spinner className="mr-2" />}
                                        Withdraw this response
                                    </Button>
                                </div>
                            </div>

                            {/* Option 2: This is not my paper */}
                            <div className={`rounded-lg border p-4 space-y-3 transition-colors ${currentDecision.status === "not_my_paper" ? "border-amber-500 bg-amber-100/60 dark:bg-amber-950/40" : "border-amber-300 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30"}`}>
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
                                        onClick={() => {
                                            setPaperStatus(key, "not_my_paper")
                                            if (ownPapers.length === 1) {
                                                void handleSinglePaperSubmit(key, "not_my_paper")
                                            }
                                        }}
                                        disabled={submitting}
                                        className="sm:min-w-[14rem] bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
                                    >
                                        {submitting && currentDecision.status === "not_my_paper" && <Spinner className="mr-2" />}
                                        This is not my paper
                                    </Button>
                                </div>
                            </div>

                            {/* Option 3: I consent to use this response */}
                            <div className={`rounded-lg border p-4 space-y-3 transition-colors ${currentDecision.status === "consented" ? "border-emerald-500 bg-emerald-100/60 dark:bg-emerald-950/40" : "border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30"}`}>
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
                                        onClick={() => {
                                            setPaperStatus(key, "consented")
                                            if (ownPapers.length === 1) {
                                                void handleSinglePaperSubmit(key, "consented")
                                            }
                                        }}
                                        disabled={submitting}
                                        className="sm:min-w-[14rem] bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                                    >
                                        {submitting && currentDecision.status === "consented" && <Spinner className="mr-2" />}
                                        I consent to use this response
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </FadeIn>
                )
            })}

            {/* Submit All Button for Multiple Papers */}
            {ownPapers.length > 1 && (
                <FadeIn delay={120} className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground font-medium">
                        {!allDecided
                            ? "Please select a decision for each paper above before submitting."
                            : "All verification decisions selected. Click to submit."}
                    </p>
                    <Button
                        size="lg"
                        onClick={() => void handleAllPapersSubmit()}
                        disabled={submitting || !allDecided}
                        className="min-w-[16rem] bg-primary text-primary-foreground font-semibold"
                    >
                        {submitting && <Spinner className="mr-2" />}
                        Submit All Verification Decisions ({ownPapers.filter((p) => Boolean(decisions[p.responseId || p.workId]?.status)).length}/{ownPapers.length})
                    </Button>
                </FadeIn>
            )}
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
