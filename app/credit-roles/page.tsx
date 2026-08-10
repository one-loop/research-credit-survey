"use client"

import { creditRoles } from "@/lib/mockData"
import { FadeIn, SurveyPageEnter } from "@/components/SurveyMotion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"

function CreditRolesContent() {
    const router = useRouter()
    const { authorId, ready: participantReady } = useSurveyParticipant()
    const [ready, setReady] = useState(false)
    const roleImportanceHref = "/role-importance"

    useEffect(() => {
        if (!participantReady) return
        if (typeof window === "undefined") return
        const keyAuthor = authorId ?? "none"
        const demographics = window.sessionStorage.getItem(`respondentDemographics_${keyAuthor}`)
        if (!demographics) {
            router.replace("/respondent-survey")
            return
        }
        setReady(true)
    }, [participantReady, authorId, router])

    if (!participantReady || !ready) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        )
    }

    return (
        <SurveyPageEnter className="max-w-4xl mx-auto p-6">
            <FadeIn>
                <h1 className="text-2xl font-bold mb-4">
                    Contributor Role Taxonomy (CRediT)
                </h1>

                <p className="mb-2 text-muted-foreground">
                    CRediT is a community-developed taxonomy of 14 contributor roles that capture the key types of contributions made to research outputs, including journal articles. It was created to complement traditional authorship by providing a clearer, more structured account of how research is produced and who contributed what.
                </p>
                <p className="mb-2 text-muted-foreground">
                    Beyond scholarly publishing, contributorship information can support research assessment, expert identification, research integrity, and accountability.
                </p>
                <p className="mb-2 text-muted-foreground">
                    Learn more:{" "}
                    <a
                        href="https://credit.niso.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4 text-primary hover:text-primary/80"
                    >
                        https://credit.niso.org
                    </a>
                </p>
                <p className="mb-6 text-muted-foreground">
                    Please familiarize yourself with the 14 CRediT roles and their definitions below. You will be able to see them later so there is no need to memorize them.
                </p>
            </FadeIn>

            <FadeIn delay={60}>
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <th scope="col" className="py-3.5 px-4 sm:px-6 w-1/3 sm:w-1/4 min-w-[180px]">
                                        Role
                                    </th>
                                    <th scope="col" className="py-3.5 px-4 sm:px-6">
                                        Definition
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 text-sm">
                                {creditRoles.map((role, idx) => (
                                    <tr
                                        key={role.id}
                                        className={`transition-colors hover:bg-muted/30 ${
                                            idx % 2 === 0 ? "bg-background" : "bg-muted/15"
                                        }`}
                                    >
                                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground align-top">
                                            {role.name}
                                        </td>
                                        <td className="py-3.5 px-4 sm:px-6 text-muted-foreground leading-relaxed align-top">
                                            {role.description}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </FadeIn>

            <FadeIn delay={120} className="mt-8 flex justify-end">
                <Button asChild>
                    <Link href={roleImportanceHref}>Continue</Link>
                </Button>
            </FadeIn>
        </SurveyPageEnter>
    )
}

export default function CreditRolesPage() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        }>
            <CreditRolesContent />
        </Suspense>
    )
}