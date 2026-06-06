"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SurveyThanksPanel } from "@/components/SurveyThanksPanel"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"
import { parseMockDistributionSampleCount } from "@/lib/survey/mockDistributionSamples"

function SurveyThanksContent() {
    const searchParams = useSearchParams()
    const experimentRaw = searchParams.get("experimentType")
    const experimentType: ExperimentType =
        experimentRaw === "B" || experimentRaw === "C" ? experimentRaw : "A"
    const queueRaw = Number(searchParams.get("queue") ?? "0")
    const queue = Number.isFinite(queueRaw) && queueRaw >= 0 ? Math.floor(queueRaw) : 0
    const mockDistributionSamples = parseMockDistributionSampleCount(
        searchParams.get("mockDistribution")
    )

    return (
        <SurveyThanksPanel
            experimentType={experimentType}
            queue={queue}
            mockDistributionSamples={mockDistributionSamples}
        />
    )
}

export default function SurveyThanksPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-lg mx-auto p-6">
                    <p className="text-muted-foreground">Loading…</p>
                </div>
            }
        >
            <SurveyThanksContent />
        </Suspense>
    )
}
