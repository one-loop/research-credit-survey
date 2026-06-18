import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import {
    computeQueueAccuracyFromRankings,
    getNextQueueIndexForSave,
    getRespondentAccuracySummary,
    incrementWorkExposure,
} from "@/lib/db/papers"
import { getParticipantAuthorId } from "@/lib/survey/participant"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import { experimentAnalyticsCacheTag } from "@/lib/db/experimentAnalytics"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"

const RESPONSES_PATH = path.join(process.cwd(), "data", "responses.json")

async function appendResponse(payload: {
    responseId: string
    workIds: string[]
    rankings: Record<string, string[]>
    authorId: string | null
    own_work: string | null
    queue_index: number
    average_accuracy?: number | null
    work_accuracies?: Record<string, number>
    role_importance: Record<string, number>
    experimentType?: ExperimentType
    completedAt: string
    time_spent?: Record<string, number> | null
    respondent_demographics?: Record<string, string> | null
}): Promise<void> {
    let existing: unknown[] = []
    try {
        const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
        existing = JSON.parse(raw) as unknown[]
    } catch {
        // file may not exist yet
    }
    existing.push(payload)
    await fs.mkdir(path.dirname(RESPONSES_PATH), { recursive: true })
    await fs.writeFile(RESPONSES_PATH, JSON.stringify(existing, null, 2), "utf-8")
}

async function resolveRespondentDemographicsForSave(
    authorId: string | undefined,
    experimentType: ExperimentType | null | undefined,
    incoming: Record<string, string> | null | undefined
): Promise<Record<string, string> | null> {
    if (incoming && Object.keys(incoming).length > 0) return incoming
    if (!authorId || !experimentType || !isSupabaseConfigured()) return incoming ?? null

    try {
        const supabase = getSupabase()
        const { data } = await supabase
            .from("experiment_responses")
            .select("respondent_demographics")
            .eq("author_id", authorId)
            .eq("experiment_type", experimentType)
            .not("respondent_demographics", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)

        const prior = (data?.[0] as { respondent_demographics?: Record<string, string> | null })
            ?.respondent_demographics
        if (prior && typeof prior === "object" && Object.keys(prior).length > 0) {
            return prior
        }
    } catch {
        // fall through
    }
    return incoming ?? null
}

export async function POST(request: NextRequest) {
    let body: {
        workIds: string[]
        rankings: Record<string, string[]>
        authorId?: string
        roleImportance?: Record<string, number>
        experimentType?: ExperimentType
        timeSpent?: Record<string, number> | null
        respondentDemographics?: Record<string, string> | null
        ownWorkId?: string | null
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    const participantId = getParticipantAuthorId(request)
    const authorId =
        (typeof body.authorId === "string" && body.authorId.trim().length > 0
            ? body.authorId.trim()
            : undefined) ?? participantId

    const {
        workIds,
        rankings,
        roleImportance,
        experimentType,
        timeSpent,
        respondentDemographics,
        ownWorkId,
    } = body

    const ownWork =
        typeof ownWorkId === "string" && ownWorkId.trim().length > 0 ? ownWorkId.trim() : null
    const queueIndex = await getNextQueueIndexForSave(authorId, experimentType ?? null)
    if (!Array.isArray(workIds) || !rankings || typeof rankings !== "object") {
        return NextResponse.json(
            { error: "Body must include workIds (array) and rankings (object)" },
            { status: 400 }
        )
    }

    const { creditRoles } = await import("@/lib/mockData")

    const roleImportanceWithDefault =
        roleImportance ??
        (Object.fromEntries(creditRoles.map((r) => [r.id, 5])) as Record<string, number>)

    const { averageAccuracy, workAccuracies } = await computeQueueAccuracyFromRankings(
        workIds,
        rankings
    )

    const demographicsForSave = await resolveRespondentDemographicsForSave(
        authorId,
        experimentType ?? null,
        respondentDemographics ?? null
    )

    let responseId: string

    if (isSupabaseConfigured()) {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .insert({
                author_id: authorId ?? null,
                work_ids: workIds,
                rankings,
                role_importance: roleImportanceWithDefault,
                experiment_type: experimentType ?? null,
                time_spent: timeSpent ?? null,
                respondent_demographics: demographicsForSave,
                own_work: ownWork,
                queue_index: queueIndex,
                average_accuracy: averageAccuracy,
                work_accuracies: workAccuracies,
            })
            .select("id")
            .single()

        if (error) {
            console.error("Failed to save experiment response:", error.message)
            return NextResponse.json(
                { ok: false, error: "Failed to save survey response" },
                { status: 500 }
            )
        }
        responseId = data.id as string
    } else {
        responseId = randomUUID()
    }

    if (!isSupabaseConfigured()) {
        await appendResponse({
            responseId,
            workIds,
            rankings,
            authorId: authorId ?? null,
            own_work: ownWork,
            queue_index: queueIndex,
            average_accuracy: averageAccuracy,
            work_accuracies: workAccuracies,
            role_importance: roleImportanceWithDefault,
            experimentType,
            completedAt: new Date().toISOString(),
            time_spent: timeSpent ?? null,
            respondent_demographics: demographicsForSave,
        })
    }

    if (isSupabaseConfigured()) {
        await incrementWorkExposure(workIds)
        if (experimentType) {
            revalidateTag(experimentAnalyticsCacheTag(experimentType), "max")
        }
    }

    const accuracySummary =
        isSupabaseConfigured() && authorId && experimentType
            ? await getRespondentAccuracySummary(authorId, experimentType, queueIndex)
            : {
                  queueAccuracy: averageAccuracy,
                  respondentAverageAccuracy: averageAccuracy,
                  queuesCompleted: averageAccuracy !== null ? 1 : 0,
              }

    return NextResponse.json({
        ok: true,
        responseId,
        queueIndex,
        queueAccuracy: accuracySummary.queueAccuracy,
        respondentAverageAccuracy: accuracySummary.respondentAverageAccuracy,
        queuesCompleted: accuracySummary.queuesCompleted,
        /** @deprecated Use queueAccuracy */
        averageAccuracy: accuracySummary.queueAccuracy,
    })
}
