"use client"

import { creditRoles } from "@/lib/mockData"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function RoleImportanceContent() {
    const searchParams = useSearchParams()
    const authorId = searchParams.get("authorId")
    const [assignedExperiment, setAssignedExperiment] = useState<"A" | "C" | null>(null)
    const trialHref = authorId ? `/trial?authorId=${encodeURIComponent(authorId)}` : "/trial"
    const [values, setValues] = useState<Record<string, number>>({})
    const [worksReady, setWorksReady] = useState(false)
    const [worksError, setWorksError] = useState<string | null>(null)
    const [isPrefetching, setIsPrefetching] = useState(false)
    const allRolesScored = creditRoles.every((role) => values[role.id] !== undefined)

    useEffect(() => {
        let cancelled = false
        fetch("/api/survey/experiment-assignment")
            .then((res) => {
                if (!res.ok) throw new Error("assignment failed")
                return res.json() as Promise<{ experiment: "A" | "C" }>
            })
            .then((data) => {
                if (!cancelled) setAssignedExperiment(data.experiment)
            })
            .catch(() => {
                if (!cancelled) setAssignedExperiment("A")
            })
        return () => {
            cancelled = true
        }
    }, [authorId])

    useEffect(() => {
        if (typeof window === "undefined" || !assignedExperiment) return
        const keyAuthor = authorId ?? "none"
        window.sessionStorage.setItem(`surveyExperiment_${keyAuthor}`, assignedExperiment)
    }, [authorId, assignedExperiment])

    // Persist partial role-importance answers as user progresses.
    useEffect(() => {
        if (typeof window === "undefined") return
        const keyAuthor = authorId ?? "none"
        const storageKey = `roleImportance_${keyAuthor}`
        window.sessionStorage.setItem(storageKey, JSON.stringify(values))
    }, [authorId, values])

    async function prefetchWorks(experiment: "A" | "C") {
        const params = new URLSearchParams()
        if (authorId) params.set("authorId", authorId)

        setWorksReady(false)
        setWorksError(null)
        setIsPrefetching(true)

        params.set("experimentType", experiment)
        fetch(`/api/survey/works?${params.toString()}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to prepare next step")
                return res.json()
            })
            .then((data: { works: unknown; dataSource?: string }) => {
                if (typeof window !== "undefined") {
                    const keyAuthor = authorId ?? "none"
                    const storageKey = `experimentWorks_${keyAuthor}`
                    window.sessionStorage.setItem(storageKey, JSON.stringify(data))
                }
                setWorksReady(true)
            })
            .catch((err) => {
                console.error("[role-importance] prefetch works error:", err)
                setWorksError(err instanceof Error ? err.message : "Failed to prepare next step")
                setWorksReady(false)
            })
            .finally(() => {
                setIsPrefetching(false)
            })
    }

    useEffect(() => {
        if (!assignedExperiment) return
        void prefetchWorks(assignedExperiment)
    }, [authorId, assignedExperiment])

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
                    const current = values[role.id]
                    return (
                    <div key={role.id} className="space-y-2">
                        <label className="font-medium block"> {role.name} </label>
                        <p className="text-sm text-muted-foreground mb-4">
                        {role.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 5 }, (_, i) => {
                            const v = i + 1
                            const isSelected = v === current
                            return (
                            <button
                                key={v}
                                type="button"
                                aria-pressed={isSelected}
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
                        Could not pre-load the next task. Please retry to continue.
                    </p>
                )}
                {worksReady && allRolesScored ? (
                    <Link href={trialHref}>
                        <Button>
                            Continue
                        </Button>
                    </Link>
                ) : worksError ? (
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (!assignedExperiment) return
                            void prefetchWorks(assignedExperiment)
                        }}
                        disabled={!assignedExperiment || isPrefetching}
                    >
                        {isPrefetching ? "Retrying…" : "Retry loading next step"}
                    </Button>
                ) : (
                    <Button disabled>
                        {!allRolesScored ? "Score every contribution to continue" : "Loading next step…"}
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