import type { Author } from "@/lib/types"

type Props = {
    authors: Author[]
    getAuthorLabel: (author: Author) => string
    title?: string
    className?: string
}

function formatTop100Institution(author: Author): { label: string; highlight: boolean } {
    if (typeof author.top100_institution === "boolean") {
        return {
            label: author.top100_institution ? "Yes" : "No",
            highlight: author.top100_institution,
        }
    }
    const raw = author.first_institution_name?.trim().toLowerCase()
    if (raw === "yes") return { label: "Yes", highlight: true }
    if (raw === "no") return { label: "No", highlight: false }
    return { label: "N/A", highlight: false }
}

function formatMetric(value: number | undefined): string {
    return typeof value === "number" && Number.isFinite(value) ? String(value) : "N/A"
}

export function ExperimentCAcademicInfoTable({
    authors,
    getAuthorLabel,
    title = "Academic information",
    className = "",
}: Props) {
    return (
        <div className={className}>
            <p className="font-medium mb-3">{title}</p>
            <div className="overflow-x-auto rounded-lg border border-violet-950 bg-card shadow-sm">
                <table className="w-full min-w-[320px] text-sm">
                    <thead>
                        <tr className="border-b border-violet-200 bg-violet-50 text-left text-violet-950">
                            <th className="px-3 py-2.5 font-semibold">Author</th>
                            <th className="px-3 py-2.5 font-semibold">Top 100 institution</th>
                            <th className="px-3 py-2.5 font-semibold">Academic age</th>
                            <th className="px-3 py-2.5 font-semibold">h-index</th>
                        </tr>
                    </thead>
                    <tbody>
                        {authors.map((author, index) => {
                            const top100 = formatTop100Institution(author)
                            return (
                                <tr
                                    key={author.id}
                                    className={
                                        index % 2 === 0
                                            ? "bg-background"
                                            : "bg-violet-50/50"
                                    }
                                >
                                    <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">
                                        {getAuthorLabel(author)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span
                                            className={
                                                top100.highlight
                                                    ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                                                    : "inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                                            }
                                        >
                                            {top100.label}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 tabular-nums text-foreground">
                                        {formatMetric(author.academic_age)}
                                    </td>
                                    <td className="px-3 py-2.5 tabular-nums text-foreground">
                                        {formatMetric(author.h_index)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
