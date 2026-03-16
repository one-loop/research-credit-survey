"use client"

import { creditRoles } from "@/lib/mockData"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Slider } from "@/components/ui/slider"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function RoleImportanceContent() {
    const searchParams = useSearchParams()
    const authorId = searchParams.get("authorId")
    const experimentHref = authorId ? `/experiment-a?authorId=${encodeURIComponent(authorId)}` : "/experiment-a"
    const [values, setValues] = useState<Record<string, number>>({})
    const [worksReady, setWorksReady] = useState(false)
    const [worksError, setWorksError] = useState<string | null>(null)

    // Persist role-importance answers so Experiment A can include them in the final submission
    useEffect(() => {
        if (typeof window === "undefined") return
        const keyAuthor = authorId ?? "none"
        const storageKey = `roleImportance_${keyAuthor}`
        window.sessionStorage.setItem(storageKey, JSON.stringify(values))
    }, [authorId, values])

    useEffect(() => {
        const params = new URLSearchParams()
        if (authorId) params.set("authorId", authorId)

        setWorksReady(false)
        setWorksError(null)

        fetch(`/api/survey/works?${params.toString()}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to prepare next step")
                return res.json()
            })
            .then((data: { works: unknown; dataSource?: string }) => {
                if (typeof window !== "undefined") {
                    const keyAuthor = authorId ?? "none"
                    const storageKey = `experimentA_works_${keyAuthor}`
                    window.sessionStorage.setItem(storageKey, JSON.stringify(data))
                }
                setWorksReady(true)
            })
            .catch((err) => {
                console.error("[role-importance] prefetch works error:", err)
                setWorksError(err instanceof Error ? err.message : "Failed to prepare next step")
                // allow user to continue anyway; Experiment A will fetch directly
                setWorksReady(false)
            })
        // re-run when authorId changes
    }, [authorId])

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-3">
                Role Importance
            </h1>

            <p className="mb-6">
                Please rate each contributor role according to its importance toward the final article.
            </p>

            <form className="space-y-6">
                {creditRoles.map((role) => {
                    const current = values[role.id] ?? 5
                    return (
                    <div key={role.id} className="space-y-2">
                        <label className="font-medium block">
                        {role.name}
                        </label>
                        <p className="text-sm text-muted-foreground mb-4">
                        {role.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 10 }, (_, i) => {
                            const v = i + 1
                            const isSelected = v === current
                            return (
                            <button
                                key={v}
                                type="button"
                                onClick={() =>
                                setValues((prev) => ({ ...prev, [role.id]: v }))
                                }
                                className={[
                                    "h-12 flex items-center justify-center flex-grow rounded-sm border text-sm font-medium bg-violet-100/50 border-violet-950 text-violet-950",
                                    "transition-all duration-150 ease-out",
                                    "hover:scale-105 hover:bg-violet-900/10",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
                                    isSelected
                                      ? "shadow-sm bg-white border-violet-950 border-2 hover:bg-white"
                                      : "bg-background text-muted-foreground"
                                  ].join(" ")}
                            >
                                {v}
                            </button>
                            )
                        })}
                        </div>
                        <div className="text-xs text-muted-foreground mb-[50px]">
                        {/* Selected: {current} */}
                        </div>
                    </div>
                    )
                })}
            </form>

            <div className="mt-8 flex flex-col items-end gap-2">
                {!worksReady && !worksError && (
                    <p className="text-xs text-muted-foreground">
                        Preparing the next task… please wait a moment.
                    </p>
                )}
                {worksError && (
                    <p className="text-xs text-destructive">
                        Could not pre-load the next task. You can continue, but the next page may take a few seconds to load.
                    </p>
                )}
                {worksReady ? (
                    <Link href={experimentHref}>
                        <Button>
                            Continue
                        </Button>
                    </Link>
                ) : (
                    <Button disabled>
                        {worksError ? "Continue (may be slower)" : "Loading next step…"}
                    </Button>
                )}
            </div>
        </div>
    )
}

export default function RoleImportancePage() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        }>
            <RoleImportanceContent />
        </Suspense>
    )
}