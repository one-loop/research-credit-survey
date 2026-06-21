"use client"

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Link from "next/link"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"
import { Suspense, useEffect, useState, type ReactNode } from "react"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Author, Work } from "@/lib/types"
import { displayJournalName } from "@/lib/survey/journalDisplay"
import {
    getAssignedExperimentFromSession,
    getRespondentContextFromSession,
    getTrialWorkForDomain,
    trialFailedKey,
    trialPassedKey,
} from "@/lib/trialWorks"
import { publicationCorrespondingSlotIndex, shuffledAuthorsForRanking } from "@/lib/shuffleAuthors"
import { ExperimentCAcademicInfoTable } from "@/components/ExperimentCAcademicInfoTable"
import { AuthorContributionsMatrix } from "@/components/AuthorContributionsMatrix"
import { cn } from "@/lib/utils"

type Phase = "welcome" | "practice" | "quiz" | "passed" | "failed"
type TutorialStep = "contributions" | "academic_info" | "byline" | "envelope" | "sort" | "done"

const Q1_CORRECT = "fixed_slot"
const Q2_CORRECT = "by_contribution"

function readRespondentDemographics(authorId: string | undefined): {
    primary_field?: string
    primary_domain?: string
} {
    if (typeof window === "undefined") return {}
    const raw = window.sessionStorage.getItem(`respondentDemographics_${authorId ?? "none"}`)
    if (!raw) return {}
    try {
        const parsed = JSON.parse(raw) as { primary_field?: string; primary_domain?: string }
        return {
            primary_field:
                typeof parsed.primary_field === "string" ? parsed.primary_field : undefined,
            primary_domain:
                typeof parsed.primary_domain === "string" ? parsed.primary_domain : undefined,
        }
    } catch {
        return {}
    }
}

function Em({ children }: { children: ReactNode }) {
    return <span className="font-semibold text-foreground">{children}</span>
}

function trialDisplayName(author: Author, experiment: "A" | "B" | "C"): string {
    if (experiment === "B") {
        const fullName = author.name?.trim()
        if (fullName) return fullName
    }
    return author.initials
}

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
    const { authorId } = useSurveyParticipant()

    const [phase, setPhase] = useState<Phase>("welcome")
    const [experiment, setExperiment] = useState<"A" | "B" | "C">("A")
    const [work, setWork] = useState<Work | null>(null)
    const [items, setItems] = useState<Author[]>([])
    const [tutorialStep, setTutorialStep] = useState<TutorialStep>("contributions")
    const [initialEnvelopeAuthorId, setInitialEnvelopeAuthorId] = useState<string | null>(null)
    const [envelopeSwapCompleted, setEnvelopeSwapCompleted] = useState(false)
    const [q1, setQ1] = useState<string>("")
    const [q2, setQ2] = useState<string>("")
    const [canAccessExperimentB, setCanAccessExperimentB] = useState(false)
    const [respondentJournal, setRespondentJournal] = useState<string | null>(null)
    const [respondentDomain, setRespondentDomain] = useState<string | null>(null)

    useEffect(() => {
        const failed = typeof window !== "undefined" && sessionStorage.getItem(trialFailedKey(authorId)) === "true"
        if (failed) {
            setPhase("failed")
            return
        }
        const exp = getAssignedExperimentFromSession(authorId)
        setExperiment(exp)
        const context = getRespondentContextFromSession(authorId)
        const demographics = readRespondentDemographics(authorId)
        const assignedJournal = context.journal ?? null
        const assignedDomain = demographics.primary_domain ?? context.domain ?? null
        setRespondentJournal(assignedJournal)
        setRespondentDomain(assignedDomain)
        const w = getTrialWorkForDomain(
            context.domain ?? assignedDomain ?? undefined,
            exp,
            assignedJournal ?? undefined
        )
        const shuffled = shuffledAuthorsForRanking(w.authors)
        setWork(w)
        setItems(shuffled)
        if (shuffled.length > 0) {
            setInitialEnvelopeAuthorId(shuffled[shuffled.length - 1]?.id ?? null)
        }
        setEnvelopeSwapCompleted(false)
        setTutorialStep("contributions")
    }, [authorId])

    useEffect(() => {
        if (typeof window === "undefined") return
        const keyAuthor = authorId ?? "none"
        const raw = window.sessionStorage.getItem(`experimentWorks_${keyAuthor}`)
        if (!raw) {
            setCanAccessExperimentB(false)
            return
        }
        try {
            const parsed = JSON.parse(raw) as {
                works?: Array<{
                    isOwnWork?: boolean
                    experiment_eligibility?: string[]
                    authors?: Array<{ id?: string }>
                }>
            }
            const ownWork = authorId
                ? parsed.works?.find(
                      (w) =>
                          w.isOwnWork ||
                          (Array.isArray(w.authors) && w.authors.some((a) => a.id === authorId))
                  )
                : parsed.works?.[0]
            const eligible = Array.isArray(ownWork?.experiment_eligibility)
                ? ownWork.experiment_eligibility.includes("B")
                : false
            setCanAccessExperimentB(eligible)
        } catch {
            setCanAccessExperimentB(false)
        }
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
            const next = arrayMove(prev, oldIndex, newIndex)
            const fixedSlot = next.length - 1
            const currentEnvelopeAuthorId = next[fixedSlot]?.id
            if (
                tutorialStep === "envelope" &&
                initialEnvelopeAuthorId &&
                currentEnvelopeAuthorId &&
                currentEnvelopeAuthorId !== initialEnvelopeAuthorId
            ) {
                setEnvelopeSwapCompleted(true)
            }
            return next
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

    const experimentPath = experiment === "C" ? "/experiment-c" : experiment === "B" ? "/experiment-b" : "/experiment-a"
    const experimentHref = experimentPath
    const experimentAHref = "/experiment-a"
    const experimentBHref = "/experiment-b"
    const experimentCHref = "/experiment-c"

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
                {/* <p className="text-muted-foreground mb-4 leading-relaxed">
                    Before the main study, you will complete a short practice on a <strong>mock example</strong> from
                    your broad area ({work.domain ?? work.field}). This is not one of the papers that will count toward the study; it
                    only shows what the questions look like and how to use the interface.
                </p> */}
                <p className="text-muted-foreground mb-4 leading-relaxed">
                    Prior to the main study, you will complete a brief practice task to familiarize you with the format of the questions and the interface. 
                </p>
                {/* <div className="rounded-lg border bg-card p-4 mb-6 space-y-3 text-sm leading-relaxed">
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
                </p> */}
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
                <div className="mb-6 rounded-md border border-dashed p-4 bg-green-50/50">
                    <p className="text-sm font-medium mb-3 text-green-600">[Debug links]</p>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={experimentAHref}>Go to Experiment A</Link>
                        </Button>
                        {canAccessExperimentB ? (
                            <Button asChild variant="outline" size="sm">
                                <Link href={experimentBHref}>Go to Experiment B</Link>
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" disabled>
                                Go to Experiment B
                            </Button>
                        )}
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
                        <RadioGroup value={q1} onValueChange={setQ1} className="space-y-2 text-sm">
                            <label className="flex gap-2 items-start cursor-pointer py-0.5">
                                <RadioGroupItem value="follows_person" className="mt-0.5" />
                                <span>
                                    The envelope always remains attached to the same author, regardless of how I reorder the list.
                                </span>
                            </label>
                            <label className="flex gap-2 items-start cursor-pointer py-0.5">
                                <RadioGroupItem value={Q1_CORRECT} className="mt-0.5" />
                                <span>
                                    The envelope remains fixed to a specific position in the list; I may reorder authors freely, and whichever author occupies that position will be shown with the envelope.
                                </span>
                            </label>
                            <label className="flex gap-2 items-start cursor-pointer py-0.5">
                                <RadioGroupItem value="only_others" className="mt-0.5" />
                                <span>The author marked with the envelope cannot be moved, while all other authors can be reordered.</span>
                            </label>
                            <label className="flex gap-2 items-start cursor-pointer py-0.5">
                                <RadioGroupItem value="always_first" className="mt-0.5" />
                                <span>The envelope always appears in the last position, regardless of the original publication.</span>
                            </label>
                        </RadioGroup>
                    </div>

                    <div>
                        <p className="font-medium mb-3">
                            2. What criterion should you follow when ordering the authors?
                        </p>
                        <RadioGroup value={q2} onValueChange={setQ2} className="space-y-2 text-sm">
                            <label className="flex gap-2 items-start cursor-pointer py-0.5">
                                <RadioGroupItem value="alpha" className="mt-0.5" />
                                <span>Arrange authors in alphabetical order by surname.</span>
                            </label>
                            <label className="flex gap-2 items-start cursor-pointer py-0.5">
                                <RadioGroupItem value={Q2_CORRECT} className="mt-0.5" />
                                <span>Arrange authors based on my own judgment and the contributions provided.</span>
                            </label>
                            <label className="flex gap-2 items-start cursor-pointer py-0.5">
                                <RadioGroupItem value="random" className="mt-0.5" />
                                <span>Arrange authors in a random order.</span>
                            </label>
                        </RadioGroup>
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
    const journalLabel = displayJournalName(respondentJournal ?? work.journal)
    const domainLabel = respondentDomain ?? work.domain ?? "your field"
    const fixedCorrSlot = Math.max(items.length - 1, 0)
    const slotPhrase =
        fixedCorrSlot < 0
            ? "—"
            : fixedCorrSlot === 0
              ? "1 (first from the left)"
              : fixedCorrSlot === items.length - 1
                ? `${items.length} (last from the left)`
                : `${fixedCorrSlot + 1} (from the left)`

    return (
        <div
            className={cn(
                "max-w-3xl mx-auto p-6",
                tutorialStep !== "done" && "pb-[28rem] sm:pb-80"
            )}
        >
            <h1 className="text-2xl font-bold mb-2">Practice Task</h1>
            <p className="text-sm text-muted-foreground mb-1">
                Mock source · Journal: <Em>{journalLabel}</Em> · Field: <Em>{domainLabel}</Em>
            </p>
            {/* <p className="text-sm text-muted-foreground mb-4">{work.display_name}</p> */}

            <div
                className={[
                    "mb-6 space-y-3 transition-opacity rounded-md",
                    tutorialStep === "contributions"
                        ? "relative z-20 bg-card/95 p-3 ring-4 ring-violet-950 ring-offset-4"
                        : tutorialStep === "done"
                          ? ""
                          : "opacity-35",
                ].join(" ")}
            >
                <p className="text-lg font-medium">Author contributions (practice)</p>
                <p className="text-sm text-muted-foreground mb-2">
                    You can hover over a role name to see more information about it.
                </p>
                <AuthorContributionsMatrix
                    authors={work.authors}
                    getAuthorLabel={(author) => trialDisplayName(author, experiment)}
                />
            </div>

            {experiment === "C" && (
                <div
                    className={[
                        "mb-6 transition-opacity rounded-md",
                        tutorialStep === "academic_info"
                            ? "relative z-20 bg-card/95 p-3 ring-4 ring-violet-950 ring-offset-4"
                            : tutorialStep === "done"
                              ? ""
                              : "opacity-35",
                    ].join(" ")}
                >
                    <ExperimentCAcademicInfoTable
                        authors={work.authors}
                        getAuthorLabel={(author) => trialDisplayName(author, experiment)}
                        title="Academic information (practice)"
                    />
                </div>
            )}

            <div
                className={[
                    "mb-6 transition-opacity rounded-md",
                    tutorialStep === "byline" || tutorialStep === "envelope" || tutorialStep === "sort"
                        ? "relative z-20 bg-card/95 p-3 ring-4 ring-violet-950 ring-offset-4"
                        : tutorialStep === "done"
                          ? ""
                          : "opacity-35",
                ].join(" ")}
            >
                <p className="font-medium mb-2 leading-relaxed">
                    Given the information above, please sort these authors in the way you think they would appear on
                    the byline of the <Em>{journalLabel}</Em> journal in the <Em>{domainLabel}</Em> field.
                </p>
                <div className="mb-4 text-muted-foreground text-sm leading-relaxed space-y-2">
                    <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0 items-start">
                        <Mail
                            className="h-3.5 w-3.5 shrink-0 stroke-violet-950 text-violet-950 mt-0.5"
                            aria-hidden
                        />
                        <p className="min-w-0 m-0">
                            The <Em>envelope icon</Em> marks the <Em>corresponding author&apos;s position</Em> on the
                            publication—the same list slot (first, middle, last, etc.) as on the paper you are shown.
                            In this practice task, that slot is fixed at position <Em>{slotPhrase}</Em>.
                        </p>
                    </div>
                    <p>
                        You may drag <Em>any author</Em>, including into or out of that slot. Whichever author you
                        place at the envelope position is shown with the icon there. Your task is to order authors by{" "}
                        <Em>contribution</Em> (your judgment); the envelope stays tied to that fixed byline position, not
                        to one person&apos;s card.
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
                                                    <span className="font-medium">{trialDisplayName(author, experiment)}</span>
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

            {tutorialStep !== "done" && (
                <>
                    <div className="fixed inset-0 bg-black/55 pointer-events-none z-10" />
                    <div className="fixed bottom-4 right-4 z-30 w-full max-w-md rounded-lg border bg-background p-4 shadow-lg">
                        {tutorialStep === "contributions" && (
                            <>
                                <p className="font-semibold mb-1">1) Contributions section</p>
                                <p className="text-sm text-muted-foreground mb-2">
                                    This section lists each author&apos;s roles. Example:{" "}
                                    <span className="text-foreground font-medium">
                                        {experiment === "A" || experiment === "C" ? "A.A: Conceptualization, Methodology, Supervision" : "Alex Avery: Conceptualization, Methodology, Supervision"}
                                    </span>{" "}
                                    means {experiment === "A" || experiment === "C" ? "A.A" : "Alex Avery"} performed these tasks for this publication.
                                </p>
                                <p className="text-sm text-muted-foreground mb-3">
                                    You can hover over any contribution role to see its definition.
                                </p>
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        onClick={() =>
                                            setTutorialStep(experiment === "C" ? "academic_info" : "byline")
                                        }
                                    >
                                        Next
                                    </Button>
                                </div>
                            </>
                        )}
                        {tutorialStep === "academic_info" && experiment === "C" && (
                            <>
                                <p className="font-semibold mb-1">2) Academic information</p>
                                <p className="text-sm text-muted-foreground mb-2">
                                    This table shows additional author details: whether they are at a top-100
                                    institution, their academic age, and h-index.
                                </p>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Use this information together with the contributions section when judging likely
                                    byline order.
                                </p>
                                <div className="flex justify-end">
                                    <Button size="sm" onClick={() => setTutorialStep("byline")}>
                                        Next
                                    </Button>
                                </div>
                            </>
                        )}
                        {tutorialStep === "byline" && (
                            <>
                                <p className="font-semibold mb-1">{experiment === "C" ? "3) Author byline" : "2) Author byline"}</p>
                                <p className="text-sm text-muted-foreground mb-2">
                                    The byline cards are shown in random order. Sort them into the order you think
                                    matches conventions in <Em>{journalLabel}</Em> for the <Em>{domainLabel}</Em> field,
                                    based on the contributions section.
                                </p>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Read the question above: the <Em>envelope</Em> marks the{" "}
                                    <Em>corresponding author&apos;s</Em> fixed position on the publication. You can
                                    reorder all authors freely—the icon stays on that slot, and whoever occupies it is
                                    shown with the envelope.
                                </p>
                                <div className="flex justify-end">
                                    <Button size="sm" onClick={() => setTutorialStep("envelope")}>
                                        Next
                                    </Button>
                                </div>
                            </>
                        )}
                        {tutorialStep === "envelope" && (
                            <>
                                <p className="font-semibold mb-1">
                                    {experiment === "C" ? "4) Corresponding author & envelope" : "3) Corresponding author & envelope"}
                                </p>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Try it now: drag any author into the envelope slot at position{" "}
                                    <Em>{slotPhrase}</Em>. The <Em>envelope</Em> does not follow a person—it marks that
                                    fixed byline position. The <Em>corresponding author</Em> on the publication is
                                    whoever you leave in that slot when you submit.
                                </p>
                                <p className="text-sm text-muted-foreground mb-3">
                                    To continue, drag a different author into the envelope slot once so you can see how
                                    the icon stays on the position while the name changes.
                                </p>
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        onClick={() => setTutorialStep("sort")}
                                        disabled={!envelopeSwapCompleted}
                                    >
                                        {envelopeSwapCompleted ? "Next" : "Swap first to continue"}
                                    </Button>
                                </div>
                            </>
                        )}
                        {tutorialStep === "sort" && (
                            <>
                                <p className="font-semibold mb-1">{experiment === "C" ? "5) Sort the byline" : "4) Sort the byline"}</p>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Please sort the author byline the way you would expect it to appear in{" "}
                                    <Em>{journalLabel}</Em> in the <Em>{domainLabel}</Em> field, based on the
                                    contributions section and all other author information shown above. Good luck!
                                </p>
                                <div className="flex justify-end">
                                    <Button size="sm" onClick={() => setTutorialStep("done")}>
                                        Finish
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            <div className="flex justify-end">
                <Button onClick={() => setPhase("quiz")} disabled={tutorialStep !== "done"}>
                    Continue to instruction check
                </Button>
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
