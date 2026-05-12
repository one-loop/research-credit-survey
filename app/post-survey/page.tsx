"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"

function PostSurveyContent() {
    const router = useRouter()
    useEffect(() => {
        router.replace("/respondent-survey")
    }, [router])

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
