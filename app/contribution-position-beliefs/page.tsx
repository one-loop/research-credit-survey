"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { creditRoles } from "@/lib/mockData"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"
import {
    type AuthorPosition,
    type CreditRolePositionBeliefs,
    creditRolePositionBeliefsStorageKey,
} from "@/lib/survey/preTaskBeliefs"
import { FadeIn, SurveyPageEnter } from "@/components/SurveyMotion"
import { cn } from "@/lib/utils"
import { trackSurveyStep } from "@/lib/survey/funnelTracker"

const POSITIONS: { value: AuthorPosition; label: string }[] = [
    { value: "first", label: "First author" },
    { value: "middle", label: "Middle author" },
    { value: "last", label: "Last author" },
]

function ContributionPositionBeliefsContent() {
    const router = useRouter()
    const { authorId, ready: participantReady } = useSurveyParticipant()
    const [values, setValues] = useState<CreditRolePositionBeliefs>({})
    const allRolesAnswered = creditRoles.every((role) => values[role.id] !== undefined)

    useEffect(() => {
        if (!participantReady) return
        trackSurveyStep({ step: "position_beliefs_roles", authorId })
    }, [participantReady, authorId])

    useEffect(() => {
        if (typeof window === "undefined") return
        const stored = window.sessionStorage.getItem(creditRolePositionBeliefsStorageKey(authorId))
        if (!stored) return
        try {
            setValues(JSON.parse(stored) as CreditRolePositionBeliefs)
        } catch {
            // ignore invalid storage
        }
    }, [authorId])

    useEffect(() => {
        if (typeof window === "undefined") return
        window.sessionStorage.setItem(
            creditRolePositionBeliefsStorageKey(authorId),
            JSON.stringify(values)
        )
    }, [authorId, values])

    return (
        <SurveyPageEnter className="max-w-3xl mx-auto p-6">
            <FadeIn>
                <h1 className="text-2xl font-bold mb-3">Contributor role expectations</h1>
                <p className="mb-6 text-muted-foreground">
                    For each contributor role below, who do you think is <span className="font-medium text-foreground">most likely</span> to perform it: the first author, a middle author, or the last author?
                </p>
            </FadeIn>

            <FadeIn delay={40}>
                <TooltipProvider>
                    <div className="flex justify-center">
                        <div className="max-w-full overflow-x-auto rounded-lg border border-violet-950 bg-card shadow-sm">
                            <table className="w-auto border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-violet-950 bg-violet-950 text-violet-100">
                                        <th className="py-2.5 px-3 text-left font-medium">Contributor role</th>
                                        {POSITIONS.map((pos) => (
                                            <th key={pos.value} className="py-2.5 px-3 text-center font-medium min-w-[90px]">
                                                {pos.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {creditRoles.map((role, idx) => (
                                        <tr
                                            key={role.id}
                                            className={cn(
                                                "border-b border-border/60 transition-colors",
                                                idx % 2 === 1 && "bg-muted/15"
                                            )}
                                        >
                                            <th
                                                scope="row"
                                                className="px-3 py-2 text-left font-normal text-muted-foreground whitespace-nowrap"
                                            >
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help underline decoration-dotted underline-offset-2">
                                                            {role.name}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" sideOffset={6} className="max-w-xs leading-relaxed">
                                                        <p>{role.description}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </th>
                                            <td colSpan={3} className="p-0">
                                                <RadioGroup
                                                    value={values[role.id] ?? ""}
                                                    onValueChange={(next) =>
                                                        setValues((prev) => ({
                                                            ...prev,
                                                            [role.id]: next as AuthorPosition,
                                                        }))
                                                    }
                                                    className="grid grid-cols-3"
                                                >
                                                    {POSITIONS.map((position) => (
                                                        <label
                                                            key={position.value}
                                                            className="flex cursor-pointer items-center justify-center px-3 py-2"
                                                        >
                                                            <RadioGroupItem
                                                                value={position.value}
                                                                aria-label={`${role.name} — ${position.label}`}
                                                                className="border-violet-950 text-violet-950"
                                                            />
                                                        </label>
                                                    ))}
                                                </RadioGroup>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TooltipProvider>
            </FadeIn>

            <FadeIn delay={120} className="mt-8 flex justify-end">
                {allRolesAnswered ? (
                    <Button
                        onClick={() => {
                            trackSurveyStep({
                                step: "position_beliefs_roles",
                                authorId,
                                metadata: {
                                    credit_role_position_beliefs: values,
                                },
                            })
                            router.push("/author-position-beliefs")
                        }}
                    >
                        Continue
                    </Button>
                ) : (
                    <Button disabled>Answer every role to continue</Button>
                )}
            </FadeIn>
        </SurveyPageEnter>
    )
}

export default function ContributionPositionBeliefsPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-3xl mx-auto p-6">
                    <p className="text-muted-foreground">Loading…</p>
                </div>
            }
        >
            <ContributionPositionBeliefsContent />
        </Suspense>
    )
}
