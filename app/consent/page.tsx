"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle } from "lucide-react"
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
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const handleConsentAction = useCallback(async (status: "consented" | "withdrawn" | "not_my_paper") => {
        if (!responseId) return
        setActionLoading(status)
        
        try {
            const res = await fetch("/api/survey/verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    responseId,
                    consentStatus: status
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
        <SurveyPageEnter className="max-w-3xl mx-auto p-6">
            <FadeIn>
                <h1 className="text-2xl font-bold mb-2">Publication Verification & Choice</h1>
                <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
                    One of the papers you evaluated during this survey was a publication for which you were identified as the corresponding author. Below, you can verify this paper with the correct (non-anonymized) author byline. If you do not wish to participate, you can choose to not participate in the study by withdrawing your responses.
                </p>
            </FadeIn>

            {ownPapers.map((paper) => {
                const pctAccuracy = paper.accuracy !== null ? Math.round(paper.accuracy * 100) : null

                return (
                    <FadeIn key={paper.workId} delay={40}>
                        <Card className="mb-6">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg font-bold leading-tight">
                                    {paper.title}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Published in {paper.journal} • {paper.year}
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
                                        <span className="font-bold text-violet-700 dark:text-violet-300 bg-violet-100/30 dark:bg-violet-950/20 px-2 py-0.5 rounded border border-violet-200/50 dark:border-violet-800/30">
                                            {pctAccuracy}%
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </FadeIn>
                )
            })}

            {/* IRB Consent Panel */}
            <FadeIn delay={80}>
                <Card className="mb-8">
                    <CardContent className="p-4 space-y-2">
                        <h3 className="font-semibold text-sm">Verification & Research Choice</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Please verify that this is your paper. You can consent to include your responses in the study, indicate that this is not your paper, or choose to withdraw your responses entirely from the research.
                        </p>
                    </CardContent>
                </Card>
            </FadeIn>

            {/* Action Buttons */}
            <FadeIn delay={120} className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 border-t pt-6">
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                        variant="destructive"
                        onClick={() => handleConsentAction("withdrawn")}
                        disabled={actionLoading !== null}
                        className="sm:min-w-[10rem] bg-gradient-to-b from-[#c8323a] via-[#b92c33] to-[#aa282f] border border-t-white/10 border-b-black/30 border-x-black/20 shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1.5px_0_rgba(255,255,255,0.2)] text-white hover:from-[#b92c33] hover:to-[#aa282f] transition-all"
                    >
                        {actionLoading === "withdrawn" && <Spinner className="mr-2" />}
                        Withdraw Response
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleConsentAction("not_my_paper")}
                        disabled={actionLoading !== null}
                        className="sm:min-w-[10rem]"
                    >
                        {actionLoading === "not_my_paper" && <Spinner className="mr-2" />}
                        This is not my paper
                    </Button>
                </div>
                <Button
                    variant="default"
                    onClick={() => handleConsentAction("consented")}
                    disabled={actionLoading !== null}
                    className="sm:min-w-[12rem] bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    {actionLoading === "consented" && <Spinner className="mr-2" />}
                    I consent to use this response
                </Button>
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
