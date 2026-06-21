"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FadeIn, SurveyPageEnter } from "@/components/SurveyMotion"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"

function StudyCompleteContent() {
    const searchParams = useSearchParams()
    const experimentRaw = searchParams.get("experimentType")
    const experimentType: ExperimentType =
        experimentRaw === "B" || experimentRaw === "C" ? experimentRaw : "A"
    const queueRaw = Number(searchParams.get("queue") ?? "0")
    const queue = Number.isFinite(queueRaw) && queueRaw >= 0 ? Math.floor(queueRaw) : 0
    const responseIdFromUrl = searchParams.get("responseId")

    const [responseId, setResponseId] = useState<string | null>(responseIdFromUrl)
    const [feedback, setFeedback] = useState("")
    const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

    useEffect(() => {
        if (responseIdFromUrl) {
            setResponseId(responseIdFromUrl)
            return
        }
        if (typeof window === "undefined") return
        const stored = window.sessionStorage.getItem(`responseId_${experimentType}_${queue}`)
        if (stored) setResponseId(stored)
    }, [responseIdFromUrl, experimentType, queue])

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

    return (
        <SurveyPageEnter className="max-w-lg mx-auto p-6">
            <FadeIn>
                <h1 className="text-3xl font-bold tracking-tight mb-4">Thank you for taking part</h1>
            </FadeIn>
            <FadeIn delay={70} className="space-y-4">
                <p className="text-base text-muted-foreground leading-relaxed">
                    Your responses are a valuable part of this experiment. We appreciate the time and
                    care you put into ranking author contributions.
                </p>
            </FadeIn>
            <FadeIn delay={110} className="mt-6 space-y-3 border-t pt-6">
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
            <FadeIn delay={150} className="mt-6 space-y-4 border-t pt-6">
                <p className="text-base text-muted-foreground leading-relaxed">
                    You may now close this window.
                </p>
                <Button variant="outline" asChild>
                    <Link href="/">Return home</Link>
                </Button>
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
