"use client"

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState, type ReactNode } from "react"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Author, Work } from "@/lib/types"
import {
    getAssignedExperimentFromSession,
    getRespondentContextFromSession,
    getTrialWorkForDomain,
    trialFailedKey,
    trialPassedKey,
} from "@/lib/trialWorks"
import { publicationCorrespondingSlotIndex, shuffledAuthorsForRanking } from "@/lib/shuffleAuthors"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type Phase = "welcome" | "practice" | "quiz" | "passed" | "failed"

const Q1_CORRECT = "fixed_slot"
const Q2_CORRECT = "by_contribution"

function TrialSortableItem({ id, children }: { id: string; children: ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="border rounded p-3 min-w-[100px] border-violet-950 text-violet-950 cursor-grab active:cursor-grabbing bg-violet-50"
        >
            {children}
        </div>
    )
}

function TrialPageContent() {
    const searchParams = useSearchParams()
    const authorId = searchParams.get("authorId") ?? undefined

    const [phase, setPhase] = useState<Phase>("welcome")
    const [experiment, setExperiment] = useState<"A" | "C">("A")
    const [work, setWork] = useState<Work | null>(null)
    const [items, setItems] = useState<Author[]>([])
    const [q1, setQ1] = useState<string>("")
    const [q2, setQ2] = useState<string>("")

    useEffect(() => {
        const failed = typeof window !== "undefined" && sessionStorage.getItem(trialFailedKey(authorId)) === "true"
        if (failed) {
            setPhase("failed")
            return
        }
        const exp = getAssignedExperimentFromSession(authorId)
        setExperiment(exp)
        const context = getRespondentContextFromSession(authorId)
        const w = getTrialWorkForDomain(context.domain, exp, context.journal, context.field)
        setWork(w)
        setItems(shuffledAuthorsForRanking(w.authors))
    }, [authorId])

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || !work) return
        const activeId = String(active.id)
        const overId = String(over.id)
        if (activeId === overId) return
        setItems((prev) => {
            const oldIndex = prev.findIndex((i) => i.id === activeId)
            const newIndex = prev.findIndex((i) => i.id === overId)
            return arrayMove(prev, oldIndex, newIndex)
        })
    }

    function submitQuiz() {
        const ok = q1 === Q1_CORRECT && q2 === Q2_CORRECT
        if (ok) {
            if (typeof window !== "undefined") {
                sessionStorage.setItem(trialPassedKey(authorId), "true")
                sessionStorage.removeItem(trialFailedKey(authorId))
            }
            setPhase("passed")
        } else {
            if (typeof window !== "undefined") {
                sessionStorage.setItem(trialFailedKey(authorId), "true")
                sessionStorage.removeItem(trialPassedKey(authorId))
            }
            setPhase("failed")
        }
    }

    const experimentPath = experiment === "C" ? "/experiment-c" : "/experiment-a"
    const experimentHref = authorId
        ? `${experimentPath}?authorId=${encodeURIComponent(authorId)}`
        : experimentPath
    const experimentAHref = authorId ? `/experiment-a?authorId=${encodeURIComponent(authorId)}` : "/experiment-a"
    const experimentBHref = authorId ? `/experiment-b?authorId=${encodeURIComponent(authorId)}` : "/experiment-b"
    const experimentCHref = authorId ? `/experiment-c?authorId=${encodeURIComponent(authorId)}` : "/experiment-c"

    if (phase === "failed") {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Survey ended</h1>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Based on your answers to the instruction check, we cannot continue with this survey session.
                    Thank you for your time.
                </p>
                <p className="text-sm text-muted-foreground">
                    If you believe this was a mistake, you may close this window and contact the study team with your
                    participant link.
                </p>
            </div>
        )
    }

    if (!work) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading practice task…</p>
            </div>
        )
    }

    if (phase === "welcome") {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Practice task</h1>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                    Before the main study, you will complete a short practice on a <strong>mock example</strong> from
                    your broad area ({work.domain ?? work.field}). This is not one of the papers that will count toward the study; it
                    only shows what the questions look like and how to use the interface.
                </p>
                <div className="rounded-lg border bg-card p-4 mb-6 space-y-3 text-sm leading-relaxed">
                    <p className="font-medium text-foreground">Corresponding author slot (envelope)</p>
                    <p className="text-muted-foreground">
                        The <strong>envelope icon</strong> marks a specific <strong>position</strong> in the author
                        list—the same index (first, middle, last, etc.) as on the publication you are shown. That{" "}
                        <strong>slot</strong> stays visually fixed: the envelope always appears at that list position.
                    </p>
                    <p className="text-muted-foreground">
                        You may <strong>drag any author</strong>, including into or out of that slot. Whichever author
                        you place at the envelope position is the one shown with the envelope there. Your task is to
                        order authors by <strong>contribution</strong> (your judgment), while the envelope continues to
                        mark that fixed publication slot.
                    </p>
                    <p className="text-muted-foreground">
                        The main study works the same way: reorder authors as you like; the envelope stays tied to
                        that byline position, not to a single person&apos;s card.
                    </p>
                </div>
                <p className="text-muted-foreground mb-6 text-sm">
                    After you try the practice ordering, you will answer two short questions. You must answer both
                    correctly to continue. If either is wrong, this survey session will end.
                </p>
                <div className="flex justify-end">
                    <Button onClick={() => setPhase("practice")}>Start practice</Button>
                </div>
            </div>
        )
    }

    if (phase === "passed") {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">You&apos;re ready</h1>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    You answered both questions correctly. We will now show you five tasks. You may not go back to a previously attempted task once you have submitted it.
                </p>
                <div className="mb-6 rounded-md border border-dashed p-4">
                    <p className="text-sm font-medium mb-3">Debug links</p>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={experimentAHref}>Go to Experiment A</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href={experimentBHref}>Go to Experiment B</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href={experimentCHref}>Go to Experiment C</Link>
                        </Button>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Link href={experimentHref}>
                        <Button>Continue to main study</Button>
                    </Link>
                </div>
            </div>
        )
    }

    if (phase === "quiz") {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-10">Instruction check</h1>
                {/* <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                    Please answer both questions. You need both correct to continue.
                </p> */}

                <div className="space-y-8 mb-8">
                    <div>
                        <p className="font-medium mb-3">
                            1. The envelope icon indicates the corresponding author’s position in the publication. Which statement best describes how it functions in this task?
                        </p>
                        <div className="space-y-2 text-sm">
                            <label className="flex gap-2 items-center cursor-pointer items-center">
                                <input type="radio" name="q1" value="follows_person" checked={q1 === "follows_person"} onChange={() => setQ1("follows_person")} />
                                <span>
                                    The envelope always remains attached to the same author, regardless of how I reorder the list.
                                </span>
                            </label>
                            <label className="flex gap-2 items-center cursor-pointer items-center">
                                <input
                                    type="radio"
                                    name="q1"
                                    value={Q1_CORRECT}
                                    checked={q1 === Q1_CORRECT}
                                    onChange={() => setQ1(Q1_CORRECT)}
                                />
                                <span>
                                    The envelope remains fixed to a specific position in the list; I may reorder authors freely, and whichever author occupies that position will be shown with the envelope.
                                </span>
                            </label>
                            <label className="flex gap-2 items-center cursor-pointer items-center">
                                <input type="radio" name="q1" value="only_others" checked={q1 === "only_others"} onChange={() => setQ1("only_others")} />
                                <span>The author marked with the envelope cannot be moved, while all other authors can be reordered.</span>
                            </label>
                            <label className="flex gap-2 items-center cursor-pointer items-center">
                                <input type="radio" name="q1" value="always_first" checked={q1 === "always_first"} onChange={() => setQ1("always_first")} />
                                <span>The envelope always appears in the last position, regardless of the original publication.</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <p className="font-medium mb-3">
                            2. What criterion should you follow when ordering the authors?
                        </p>
                        <div className="space-y-2 text-sm">
                            <label className="flex gap-2 items-center cursor-pointer items-center">
                                <input type="radio" name="q2" value="alpha" checked={q2 === "alpha"} onChange={() => setQ2("alpha")} />
                                <span>Arrange authors in alphabetical order by surname.</span>
                            </label>
                            <label className="flex gap-2 items-center cursor-pointer items-center">
                                <input
                                    type="radio"
                                    name="q2"
                                    value={Q2_CORRECT}
                                    checked={q2 === Q2_CORRECT}
                                    onChange={() => setQ2(Q2_CORRECT)}
                                />
                                <span>Arrange authors based on my own judgment and the contributions provided.</span>
                            </label>
                            <label className="flex gap-2 items-center cursor-pointer items-center">
                                <input type="radio" name="q2" value="random" checked={q2 === "random"} onChange={() => setQ2("random")} />
                                <span>Arrange authors in a random order.</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" type="button" onClick={() => setPhase("practice")}>
                        Back to practice
                    </Button>
                    <Button type="button" onClick={submitQuiz} disabled={!q1 || !q2}>
                        Submit answers
                    </Button>
                </div>
            </div>
        )
    }

    // phase === "practice"
    const fixedCorrSlot = publicationCorrespondingSlotIndex(work.authors)
    const slotPhrase =
        fixedCorrSlot < 0
            ? "—"
            : fixedCorrSlot === 0
              ? "1 (first from the left)"
              : fixedCorrSlot === items.length - 1
                ? `${items.length} (last from the left)`
                : `${fixedCorrSlot + 1} (from the left)`

    const roleDetailsMap: Record<string, { verb: string; description: string }> = {
        Conceptualization: { verb: "conceived the study", description: "Ideas, formulation or evolution of overarching research goals and aims." },
        Methodology: { verb: "designed methods", description: "Development or design of methodology; creation of models." },
        Supervision: { verb: "supervised the work", description: "Oversight and leadership responsibility for planning and execution." },
        Investigation: { verb: "ran investigations", description: "Conducting experiments or data/evidence collection." },
        "Formal analysis": { verb: "analyzed data", description: "Application of formal techniques to analyze data." },
        Visualization: { verb: "made figures", description: "Preparation and creation of visual representations and data presentations." },
        "Data curation": { verb: "curated data", description: "Data annotation, cleaning, and maintenance for use/reuse." },
        "Writing – original draft": { verb: "drafted the paper", description: "Preparation and creation of the initial manuscript draft." },
        "Writing – review & editing": { verb: "edited the paper", description: "Critical review, commentary, or revision of the manuscript." },
        "Project administration": { verb: "administered the project", description: "Management and coordination for planning and execution." },
        Software: { verb: "built software", description: "Programming, software development, and implementation of code and supporting algorithms." },
        Validation: { verb: "validated results", description: "Verification and reproducibility of results, experiments, or outputs." },
        Resources: { verb: "provided resources", description: "Provision of materials, instrumentation, computing resources, or other tools." },
        "Funding acquisition": { verb: "secured funding", description: "Acquisition of financial support for the project." },
    }

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-2">Practice: author order</h1>
            <p className="text-sm text-muted-foreground mb-1">
                Mock source · Domain: <span className="font-medium text-foreground">{work.domain ?? work.field}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-4">{work.display_name}</p>

            <div className="mb-6 space-y-3">
                <p className="text-lg font-medium">Author contributions (practice)</p>
                <p className="text-sm text-muted-foreground mb-2">
                    You can hover over a contribution role to see more information about it.
                </p>
                <div className="space-y-1 text-md text-muted-foreground">
                    {work.authors.map((author) => (
                        <p key={author.id}>
                            <span className="font-medium text-foreground">{author.initials}</span>:{" "}
                            <TooltipProvider>
                                {author.contributions.map((role, idx) => (
                                    <span key={`${author.id}-${role}-${idx}`}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="cursor-help decoration-dotted underline-offset-4 hover:underline">
                                                    {role}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                                {/* <p className="font-semibold">{role}</p> */}
                                                <p>{roleDetailsMap[role]?.description ?? role}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                        {idx < author.contributions.length - 1 ? ", " : ""}
                                    </span>
                                ))}
                            </TooltipProvider>
                        </p>
                    ))}
                </div>
            </div>

            {experiment === "C" && (
                <div className="mb-6">
                    <p className="font-medium mb-2">Academic information (practice)</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                        {work.authors.map((author) => (
                            <p key={author.id}>
                                <span className="font-medium text-foreground">{author.initials}</span>: Institution:{" "}
                                {author.first_institution_name ?? "N/A"}; Academic age: {author.academic_age ?? "N/A"};
                                h-index: {author.h_index ?? "N/A"}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            <div className="mb-6">
                <p className="font-medium mb-2">
                    Given the information above, please sort these authors in the way you think they would appear in
                    the byline of the <span className="text-foreground">{work.journal}</span> journal in the{" "}
                    <span className="text-foreground">{work.field}</span> field.
                </p>
                <div className="mb-4 text-muted-foreground text-sm leading-relaxed grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0 items-start">
                    <Mail
                        className="h-3.5 w-3.5 shrink-0 stroke-violet-950 text-violet-950 mt-0.5"
                        aria-hidden
                    />
                    <p className="min-w-0 m-0">
                        The envelope icon refers to the corresponding author position and stays at publication slot{" "}
                        <span className="font-medium text-foreground">{slotPhrase}</span>
                        ; whoever you place there is shown with the icon.
                    </p>
                </div>
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
                        <div className="flex flex-row flex-wrap gap-3">
                            {items.map((author, positionIndex) => {
                                const showEnvelope = fixedCorrSlot >= 0 && positionIndex === fixedCorrSlot
                                return (
                                    <TrialSortableItem key={author.id} id={author.id}>
                                        <div className="flex items-center gap-1.5 justify-center">
                                            <span className="font-medium">{author.initials}</span>
                                            {showEnvelope && (
                                                <Mail className="h-3.5 w-3.5 stroke-violet-950 text-violet-950" />
                                            )}
                                        </div>
                                    </TrialSortableItem>
                                )
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            <div className="flex justify-end">
                <Button onClick={() => setPhase("quiz")}>Continue to instruction check</Button>
            </div>
        </div>
    )
}

export default function TrialPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-3xl mx-auto p-6">
                    <p className="text-muted-foreground">Loading…</p>
                </div>
            }
        >
            <TrialPageContent />
        </Suspense>
    )
}
