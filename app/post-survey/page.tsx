"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function PostSurveyContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const authorId = searchParams.get("authorId") ?? undefined
    useEffect(() => {
        const href = authorId
            ? `/respondent-survey?authorId=${encodeURIComponent(authorId)}`
            : "/respondent-survey"
        router.replace(href)
    }, [authorId, router])

    return (
        <div className="max-w-lg mx-auto p-6">
            <p className="text-muted-foreground">Redirecting…</p>
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
