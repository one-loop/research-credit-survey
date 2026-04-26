import { NextResponse } from "next/server"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

type ExperimentType = "A" | "B" | "C"

function randomExperiment(opts?: { allowB?: boolean }): ExperimentType {
    const allowB = opts?.allowB ?? true
    const experiments: ExperimentType[] = allowB ? ["A", "B", "C"] : ["A", "C"]
    return experiments[Math.floor(Math.random() * experiments.length)] ?? "A"
}

async function isRespondentEligibleForExperimentB(authorId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return true
    try {
        const supabase = getSupabase()
        const escapedAuthorId = authorId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        const { data, error } = await supabase
            .from("papers")
            .select("experiment_eligibility")
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

        const experiment = responses[0]?.experiment_type
        return experiment === "A" || experiment === "B" || experiment === "C" ? experiment : null
    } catch {
        return null
    }
}

/**
 * GET — returns assigned experiment for this session.
 * If respondent has any seen work, assignment is the experiment of the most recent seen work.
 * Otherwise assignment is randomized across A/B/C.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const authorId = searchParams.get("authorId")?.trim()

    if (!isSupabaseConfigured()) {
        const experiment = randomExperiment()
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

    if (authorId) {
        const seenExperiment = await getMostRecentSeenExperimentForRespondent(authorId)
        if (seenExperiment && (seenExperiment !== "B" || allowB)) {
            return NextResponse.json({
                experiment: seenExperiment,
                lockedBySeenWork: true,
                dataSource: "supabase" as const,
            })
        }
    }

    const experiment = randomExperiment({ allowB })

    return NextResponse.json({
        experiment,
        lockedBySeenWork: false,
        dataSource: "supabase" as const,
    })
}
