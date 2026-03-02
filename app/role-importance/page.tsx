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
                {creditRoles.map(role => (
                    <div key={role.id}>
                        <label className="font-medium">
                            {role.name}
                        </label>
                        {/* <Controller
                            name={role.id}
                            control={control}
                            render={({ field }) => (
                                <Slider
                                    min={1}
                                    max={10}
                                    step={1}
                                    className="mx-auto w-full"
                                    value={[field.value ?? 5]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                />
                            )}
                        />
                        <div className="text-sm text-gray-500">
                            Value: {watch(role.id) ?? 5}
                        </div>           */}
                        <Slider
                            min={1}
                            max={10}
                            step={1}
                            defaultValue={[5]}
                            onValueChange={([v]) => setValues(prev => ({ ...prev, [role.id]: v}))}
                        />
                        <div className="text-sm text-muted-foreground mt-1">
                            Value: {values[role.id] ?? 5}
                        </div>
                    </div>
                ))}
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