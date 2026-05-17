"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function SurveyThanksPage() {
    const searchParams = useSearchParams()
    const experimentType = searchParams.get("experimentType")
    const queueRaw = Number(searchParams.get("queue") ?? "0")
    const queue = Number.isFinite(queueRaw) && queueRaw >= 0 ? Math.floor(queueRaw) : 0
    const nextQueue = queue + 1
    const continueHref =
        experimentType === "B"
            ? `/experiment-b?queue=${nextQueue}`
            : experimentType === "C"
              ? `/experiment-c?queue=${nextQueue}`
              : `/experiment-a?queue=${nextQueue}`

    return (
        <div className="max-w-lg mx-auto p-6">
            <h1 className="text-2xl font-bold mb-3">Thank you</h1>
            <p className="text-muted-foreground leading-relaxed mb-6">
                Your responses are complete. We appreciate you taking the time to participate in this study.
            </p>
            <div className="flex justify-end">
                <Button asChild>
                    <Link href={continueHref}>Do 5 more tasks</Link>
                </Button>
            </div>
        </div>
    )
}
