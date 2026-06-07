import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import { getParticipantAuthorId } from "@/lib/survey/participant"
import {
    experimentFromOrderedResponses,
    resolveExperimentAssignment,
    type ExperimentType,
} from "@/lib/survey/experimentAssignment"

async function isRespondentEligibleForExperimentB(authorId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return true
    try {
        const supabase = getSupabase()
        const escapedAuthorId = authorId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        const { data, error } = await supabase
            .from("papers")
            .select("experiment_eligibility")
            .eq("contributions_complete", true)
            .or(`authors.cs.[{"id":"${escapedAuthorId}"}],authors.cs.[{"author_id":"${escapedAuthorId}"}]`)
            .order("publication_date", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error || !data) return false
        const eligibility = data.experiment_eligibility
        return Array.isArray(eligibility) && eligibility.includes("B")
    } catch {
        return false
    }
}

/**
 * Returns the most recently seen experiment for any of the respondent's works.
 * "Seen" means the work_id appeared in at least one row of experiment_responses.
 */
async function getMostRecentSeenExperimentForRespondent(
    authorId: string
): Promise<ExperimentType | null> {
    if (!isSupabaseConfigured()) return null
    try {
        const supabase = getSupabase()
        const escapedAuthorId = authorId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

        // Find respondent-owned works.
        const { data: papers, error: papersError } = await supabase
            .from("papers")
            .select("work_id")
            .or(`authors.cs.[{"id":"${escapedAuthorId}"}],authors.cs.[{"author_id":"${escapedAuthorId}"}]`)

        if (papersError || !papers?.length) return null

        const respondentWorkIds = papers
            .map((row) => row.work_id)
            .filter((workId): workId is string => typeof workId === "string" && workId.length > 0)

        if (respondentWorkIds.length === 0) return null

        // Most recent seen work decides assignment.
        const { data: responses, error: responsesError } = await supabase
            .from("experiment_responses")
            .select("experiment_type,created_at")
            .in("experiment_type", ["A", "B", "C"])
            .overlaps("work_ids", respondentWorkIds)
            .order("created_at", { ascending: false })
            .limit(1)

        if (responsesError || !responses?.length) return null

        return experimentFromOrderedResponses(
            responses as Array<{ experiment_type: unknown; created_at: string }>
        )
    } catch {
        return null
    }
}

/**
 * GET — returns assigned experiment for this session.
 * If respondent has any seen work, assignment is the experiment of the most recent seen work.
 * Otherwise assignment is randomized across A/B/C.
 */
export async function GET(request: NextRequest) {
    const authorId = getParticipantAuthorId(request)?.trim()

    if (!isSupabaseConfigured()) {
        const { experiment } = resolveExperimentAssignment({
            seenExperiment: null,
            allowB: true,
        })
        return NextResponse.json({
            experiment,
            lockedBySeenWork: false,
            dataSource: "mock" as const,
        })
    }

    let allowB = true
    if (authorId) {
        allowB = await isRespondentEligibleForExperimentB(authorId)
    }

    const seenExperiment = authorId ? await getMostRecentSeenExperimentForRespondent(authorId) : null
    const { experiment, lockedBySeenWork } = resolveExperimentAssignment({
        seenExperiment,
        allowB,
    })

    return NextResponse.json({
        experiment,
        lockedBySeenWork,
        dataSource: "supabase" as const,
    })
}
