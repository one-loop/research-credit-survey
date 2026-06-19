"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
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
import { FadeIn, FadeInStagger, SurveyPageEnter } from "@/components/SurveyMotion"
import { cn } from "@/lib/utils"

const POSITIONS: { value: AuthorPosition; label: string }[] = [
    { value: "first", label: "First author" },
    { value: "middle", label: "Middle author" },
    { value: "last", label: "Last author" },
]

function ContributionPositionBeliefsContent() {
    const { authorId } = useSurveyParticipant()
    const [values, setValues] = useState<CreditRolePositionBeliefs>({})
    const allRolesAnswered = creditRoles.every((role) => values[role.id] !== undefined)

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
                                    <tr className="border-b border-violet-200 bg-violet-50 text-violet-950">
                                        <th className="px-3 py-2.5 text-right font-semibold">Role</th>
                                        {POSITIONS.map((position) => (
                                            <th
                                                key={position.value}
                                                className="px-3 py-2.5 text-center font-semibold whitespace-nowrap"
                                            >
                                                {position.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {creditRoles.map((role, rowIndex) => (
                                        <tr
                                            key={role.id}
                                            className={rowIndex % 2 === 0 ? "bg-background" : "bg-violet-50/50"}
                                        >
                                            <th
                                                scope="row"
                                                className={cn(
                                                    "px-3 py-2 text-right font-normal text-muted-foreground whitespace-nowrap",
                                                    rowIndex % 2 === 0 ? "bg-background" : "bg-violet-50/50"
                                                )}
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
                    <Button asChild>
                        <Link href="/author-position-beliefs">Continue</Link>
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
