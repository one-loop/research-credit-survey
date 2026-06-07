"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FadeIn, SurveyPageEnter } from "@/components/SurveyMotion"

export default function StudyCompletePage() {
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
                <p className="text-base text-muted-foreground leading-relaxed">
                    You may now close this window. If you received a completion code or follow-up
                    instructions from your recruiter, please use those as directed.
                </p>
            </FadeIn>
            <FadeIn delay={140} className="mt-6">
                <Button variant="outline" asChild>
                    <Link href="/">Return home</Link>
                </Button>
            </FadeIn>
        </SurveyPageEnter>
    )
}
