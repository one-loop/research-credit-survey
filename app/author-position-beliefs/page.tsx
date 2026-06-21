"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"
import {
    type AuthorPositionBeliefs,
    type FirstLastPosition,
    authorPositionBeliefsStorageKey,
} from "@/lib/survey/preTaskBeliefs"
import { FadeIn, FadeInStagger, SurveyPageEnter } from "@/components/SurveyMotion"

function AuthorPositionBeliefsContent() {
    const { authorId } = useSurveyParticipant()
    const [younger, setYounger] = useState<FirstLastPosition | "">("")
    const [pi, setPi] = useState<FirstLastPosition | "">("")
    const allAnswered = younger !== "" && pi !== ""

    useEffect(() => {
        if (typeof window === "undefined") return
        const stored = window.sessionStorage.getItem(authorPositionBeliefsStorageKey(authorId))
        if (!stored) return
        try {
            const parsed = JSON.parse(stored) as Partial<AuthorPositionBeliefs>
            if (parsed.younger === "first" || parsed.younger === "last") setYounger(parsed.younger)
            if (parsed.pi === "first" || parsed.pi === "last") setPi(parsed.pi)
        } catch {
            // ignore invalid storage
        }
    }, [authorId])

    useEffect(() => {
        if (typeof window === "undefined") return
        if (younger === "" || pi === "") return
        const payload: AuthorPositionBeliefs = { younger, pi }
        window.sessionStorage.setItem(authorPositionBeliefsStorageKey(authorId), JSON.stringify(payload))
    }, [authorId, younger, pi])

    return (
        <SurveyPageEnter className="max-w-3xl mx-auto p-6">
            <FadeIn>
                <h1 className="text-2xl font-bold mb-3">Authorship expectations</h1>
                <p className="mb-6 text-muted-foreground">
                    Please answer the following based on your own judgment and experience with research collaboration in your field.
                </p>
            </FadeIn>

            <FadeInStagger className="space-y-8" step={50}>
                <div className="space-y-3">
                    <p className="font-medium">Who is most likely to be younger?</p>
                    <RadioGroup
                        value={younger}
                        onValueChange={(value) => setYounger(value as FirstLastPosition)}
                        className="space-y-2 text-sm"
                    >
                        <label className="flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50/40 px-3 py-2.5 cursor-pointer">
                            <RadioGroupItem value="first" className="mt-0.5 border-violet-950 text-violet-950" />
                            <span>First author</span>
                        </label>
                        <label className="flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50/40 px-3 py-2.5 cursor-pointer">
                            <RadioGroupItem value="last" className="mt-0.5 border-violet-950 text-violet-950" />
                            <span>Last author</span>
                        </label>
                    </RadioGroup>
                </div>

                <div className="space-y-3">
                    <p className="font-medium">Who is most likely to be PI (Primary Investigator)?</p>
                    <RadioGroup
                        value={pi}
                        onValueChange={(value) => setPi(value as FirstLastPosition)}
                        className="space-y-2 text-sm"
                    >
                        <label className="flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50/40 px-3 py-2.5 cursor-pointer">
                            <RadioGroupItem value="first" className="mt-0.5 border-violet-950 text-violet-950" />
                            <span>First author</span>
                        </label>
                        <label className="flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50/40 px-3 py-2.5 cursor-pointer">
                            <RadioGroupItem value="last" className="mt-0.5 border-violet-950 text-violet-950" />
                            <span>Last author</span>
                        </label>
                    </RadioGroup>
                </div>
            </FadeInStagger>

            <FadeIn delay={120} className="mt-8 flex justify-end">
                {allAnswered ? (
                    <Button asChild>
                        <Link href="/trial">Continue</Link>
                    </Button>
                ) : (
                    <Button disabled>Answer both questions to continue</Button>
                )}
            </FadeIn>
        </SurveyPageEnter>
    )
}

export default function AuthorPositionBeliefsPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-3xl mx-auto p-6">
                    <p className="text-muted-foreground">Loading…</p>
                </div>
            }
        >
            <AuthorPositionBeliefsContent />
        </Suspense>
    )
}
