"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeIn, SurveyPageEnter } from "@/components/SurveyMotion"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"
import type { VerificationResponsePayload } from "@/app/api/survey/verification/route"

function StudyCompleteContent() {
    const searchParams = useSearchParams()
    const { authorId } = useSurveyParticipant()
    const experimentRaw = searchParams.get("experimentType")
    const experimentType: ExperimentType =
        experimentRaw === "B" || experimentRaw === "C" ? experimentRaw : "A"
    const queueRaw = Number(searchParams.get("queue") ?? "0")
    const queue = Number.isFinite(queueRaw) && queueRaw >= 0 ? Math.floor(queueRaw) : 0
    const responseIdFromUrl = searchParams.get("responseId")

    const [responseId, setResponseId] = useState<string | null>(responseIdFromUrl)
    const [feedback, setFeedback] = useState("")
    const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
    const [ownPapers, setOwnPapers] = useState<VerificationResponsePayload[]>([])

    useEffect(() => {
        if (responseIdFromUrl) {
            setResponseId(responseIdFromUrl)
            return
        }
        if (typeof window === "undefined") return
        const stored = window.sessionStorage.getItem(`responseId_${experimentType}_${queue}`)
        if (stored) setResponseId(stored)
    }, [responseIdFromUrl, experimentType, queue])

    useEffect(() => {
        const query = responseId
            ? `responseId=${encodeURIComponent(responseId)}`
            : authorId
              ? `authorId=${encodeURIComponent(authorId)}`
              : null

        if (!query) return

        fetch(`/api/survey/verification?${query}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { ok?: boolean; ownPapers?: VerificationResponsePayload[] }) => {
                if (data?.ok && Array.isArray(data.ownPapers)) {
                    setOwnPapers(data.ownPapers)
                }
            })
            .catch(() => {})
    }, [responseId, authorId])

    async function submitFeedback() {
        const trimmed = feedback.trim()
        if (!trimmed || feedbackStatus === "saving") return

        setFeedbackStatus("saving")
        try {
            const res = await fetch("/api/survey/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    feedback: trimmed,
                    responseId: responseId ?? undefined,
                    experimentType,
                    queueIndex: queue,
                }),
            })
            const data = (await res.json()) as { ok?: boolean; error?: string }
            if (!res.ok || !data.ok) {
                setFeedbackStatus("error")
                return
            }
            setFeedbackStatus("saved")
        } catch {
            setFeedbackStatus("error")
        }
    }

    const canSubmitFeedback = feedback.trim().length > 0 && feedbackStatus !== "saving" && feedbackStatus !== "saved"

    const withdrawnCount = ownPapers.filter((p) => p.consentStatus === "withdrawn").length
    const notMyPaperCount = ownPapers.filter((p) => p.consentStatus === "not_my_paper").length

    return (
        <SurveyPageEnter className="max-w-lg mx-auto p-6 space-y-6">
            <FadeIn>
                <h1 className="text-3xl font-bold tracking-tight mb-4">Thank you for taking part</h1>
            </FadeIn>

            {/* Custom Consent / Verification Notice Banners */}
            <FadeIn delay={70} className="space-y-4">
                {withdrawnCount > 0 && notMyPaperCount > 0 ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-2 text-amber-950 dark:text-amber-100 text-sm leading-relaxed">
                        <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            Data Exclusion Notice
                        </div>
                        <p>
                            Your decision to withdraw responses as well as your indication that certain paper(s) were not yours have been recorded. All responses and data associated with these paper(s) will be excluded and will not be used in the study analyses.
                        </p>
                    </div>
                ) : withdrawnCount > 0 ? (
                    <div className="rounded-lg border border-red-300 bg-red-50/70 dark:bg-red-950/30 p-4 space-y-2 text-red-950 dark:text-red-100 text-sm leading-relaxed">
                        <div className="flex items-center gap-2 font-semibold text-red-900 dark:text-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                            Withdrawal Confirmation
                        </div>
                        <p>
                            Your request to withdraw has been recorded. The responses and data associated with the paper(s) you withdrew will be excluded from all future study analyses.
                        </p>
                    </div>
                ) : notMyPaperCount > 0 ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-2 text-amber-950 dark:text-amber-100 text-sm leading-relaxed">
                        <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            Verification Update
                        </div>
                        <p>
                            Your indication that paper(s) were not yours has been recorded. These responses will not be included in the own-paper sub-analysis.
                        </p>
                    </div>
                ) : (
                    <p className="text-base text-muted-foreground leading-relaxed">
                        Your responses are a valuable part of this experiment. We appreciate the time and
                        care you put into ranking author contributions.
                    </p>
                )}
            </FadeIn>

            {/* Optional Feedback Section */}
            <FadeIn delay={110} className="space-y-3 border-t pt-6">
                <div>
                    <label htmlFor="survey-feedback" className="block text-sm font-medium text-foreground">
                        Feedback <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        Did you have any problems with the survey, questions, or suggestions? Share them here.
                    </p>
                </div>
                <textarea
                    id="survey-feedback"
                    value={feedback}
                    onChange={(e) => {
                        setFeedback(e.target.value)
                        if (feedbackStatus === "saved" || feedbackStatus === "error") {
                            setFeedbackStatus("idle")
                        }
                    }}
                    rows={4}
                    maxLength={4000}
                    placeholder="Problems, questions, or suggestions…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[6rem]"
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        {feedbackStatus === "saved"
                            ? "Thank you — your feedback was saved."
                            : feedbackStatus === "error"
                                ? "Could not save feedback. You can try again."
                                : null}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="sm:min-w-[8rem]"
                        disabled={!canSubmitFeedback}
                        onClick={() => void submitFeedback()}
                    >
                        {feedbackStatus === "saving" ? "Saving…" : "Submit feedback"}
                    </Button>
                </div>
            </FadeIn>

            {/* Closing Message */}
            <FadeIn delay={150} className="space-y-4 border-t pt-6">
                <p className="text-base text-muted-foreground leading-relaxed">
                    You may now close this window.
                </p>
            </FadeIn>
        </SurveyPageEnter>
    )
}

export default function StudyCompletePage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-lg mx-auto p-6">
                    <p className="text-muted-foreground">Loading…</p>
                </div>
            }
        >
            <StudyCompleteContent />
        </Suspense>
    )
}
