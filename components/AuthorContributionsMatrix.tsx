"use client"

import {
    CREDIT_ROLE_ROWS,
    authorHasCreditRole,
} from "@/lib/survey/creditRoleMatching"
import type { Author } from "@/lib/types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = {
    authors: Author[]
    getAuthorLabel?: (author: Author) => string
    className?: string
}

export function AuthorContributionsMatrix({
    authors,
    getAuthorLabel = (author) => author.initials,
    className,
}: Props) {
    if (authors.length === 0) return null

    return (
        <TooltipProvider>
            <div className={cn("flex w-full justify-center", className)}>
                <div className="max-w-full overflow-x-auto rounded-lg border border-violet-950 bg-card shadow-sm">
                    <table className="w-auto border-collapse text-xs">
                    <thead>
                        <tr className="border-b border-violet-200 bg-violet-50 text-violet-950">
                            <th
                                scope="col"
                                className="sticky left-0 z-20 border-r border-violet-200 bg-violet-50 px-3 py-2.5 text-right font-semibold"
                            >
                                Role
                            </th>
                            {authors.map((author) => {
                                const label = getAuthorLabel(author)
                                return (
                                    <th
                                        key={`head-${author.id}`}
                                        scope="col"
                                        className="px-2 py-2.5 text-center font-semibold leading-snug whitespace-nowrap"
                                    >
                                        {label}
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {CREDIT_ROLE_ROWS.map((role, rowIndex) => (
                            <tr
                                key={role.id}
                                className={rowIndex % 2 === 0 ? "bg-background" : "bg-violet-50/50"}
                            >
                                <th
                                    scope="row"
                                    className={cn(
                                        "sticky left-0 z-10 border-r border-violet-200 px-3 py-1.5 text-right font-normal text-muted-foreground whitespace-nowrap",
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

                                {authors.map((author) => {
                                    const active = authorHasCreditRole(author.contributions, role.name)
                                    const label = getAuthorLabel(author)
                                    return (
                                        <td
                                            key={`${role.id}-${author.id}`}
                                            className="px-2 py-1.5 text-center"
                                            aria-label={`${label} — ${role.name}: ${active ? "yes" : "no"}`}
                                            title={`${label} · ${role.name}`}
                                        >
                                            <span
                                                className={cn(
                                                    "mx-auto block h-3.5 w-3.5 rounded-sm border",
                                                    active
                                                        ? "border-violet-900 bg-violet-800"
                                                        : "border-violet-200/80 bg-muted/60"
                                                )}
                                            />
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
        </TooltipProvider>
    )
}
